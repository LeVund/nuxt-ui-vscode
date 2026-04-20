# Architecture & Feature Map

Overview of how the Nuxt UI VS Code extension works internally: lifecycle phases, features, and key functions.

---

## File Structure

```
src/
├── extension.ts                       # Entry point — activate / deactivate
├── activation/
│   ├── registerProviders.ts           # Registers CodeLens provider
│   └── registerCommands.ts            # Registers the openDocPanel command
├── commands/
│   └── commandIds.enum.ts             # Single source of truth for command IDs
├── core/
│   ├── components.ts                  # Static registry of Nuxt UI components
│   └── types.ts                       # Shared type definitions
├── editor/
│   ├── findComponentAt.ts             # Locate the component tag at a given position
│   ├── getTagContext.ts               # Open document + parse the opening tag
│   └── indentation.ts                 # Read leading whitespace of a line
├── insertions/
│   ├── insertSlot.ts                  # Inject <template #name> in the editor
│   ├── insertProp.ts                  # Inject :prop="" in the editor
│   ├── insertEvent.ts                 # Inject @event-name="" in the editor
│   ├── insertVModel.ts                # Inject v-model[:name]="" in the editor
│   ├── insertUiKey.ts                 # Inject key inside :ui="{ … }"
│   └── removeAttribute.ts             # Remove a prop / event / v-model attribute
├── parsing/
│   ├── caseUtils.ts                   # PascalCase ↔ kebab-case + tag → URL slug
│   ├── findMatchingCloseTag.ts        # Depth-aware </Tag> finder
│   ├── getParseTag.ts                 # Find the end of an opening tag (string-aware)
│   ├── parseAttributes.ts             # Attribute scanner + classifier (prop/event/vmodel)
│   └── scanComponents.ts             # Regex scanner for <U…> tags
├── providers/
│   └── CodeLensProvider.ts            # CodeLens provider ($(telescope) glyph above each tag)
├── typeInfo/
│   ├── readComponentInfo.ts           # Extracts slots / props / events / vModels / ui keys
│   ├── resolveDeclarationPath.ts      # Maps `.vue` → `.vue.d.ts`
│   └── resolveUiKeys.ts               # Extracts `:ui` keys from the theme file
├── version/
│   ├── VersionService.ts              # Detects & watches Nuxt UI version (v3 / v4)
│   ├── detectFromPackageJson.ts       # Reads `@nuxt/ui` from workspace package.json
│   └── parseMajor.ts                  # Extracts the major number from a semver range
└── webview/
    ├── DocPanel.ts                    # Sidebar WebviewView (docs iframe + insertion UI)
    ├── resolveComponentInfo.ts        # Calls TS definition provider, then readComponentInfo
    ├── urls.ts                        # Builds doc paths for v3 / v4
    └── html/
        ├── renderHtml.ts              # Top-level HTML template (CSP, sections)
        ├── renderSection.ts           # One accordion section (slots / props / events / ui)
        ├── renderVModelsSection.ts    # Accordion section for v-model bindings
        ├── renderPlaceholder.ts       # Empty-state HTML shown before any component is opened
        ├── escape.ts                  # HTML / attribute escaping helpers
        ├── styles.ts                  # Inlined CSS string
        └── webviewScript.ts           # Inlined webview-side JS (accordion + button → postMessage)
```

---

## Extension Lifecycle

```
VS Code opens a .vue file
        │
        ▼
┌─────────────────────────────────────────────────────────────────────┐
│  activate(context)         (src/extension.ts)                       │
│                                                                     │
│  1. new VersionService()                resolve & watch version     │
│  2. new DocPanel(version)               create sidebar webview      │
│  3. registerWebviewViewProvider(panel)  mount sidebar panel         │
│  4. registerProviders(context)          register CodeLens provider  │
│  5. registerCommands(context, panel)    wire up the command         │
└─────────────────────────────────────────────────────────────────────┘
        │
        │  (user edits, clicks — see Runtime section)
        │
VS Code closes / extension deactivated
        │
        ▼
┌──────────────────────────────────────────────┐
│  deactivate()  (no-op)                       │
│  All context.subscriptions auto-disposed     │
└──────────────────────────────────────────────┘
```

---

## Runtime Event Map

| Trigger                                      | Handler                                          | Action                                                      |
| -------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------- |
| `.vue` file opened                           | `activate()`                                     | Registers all providers & commands                          |
| `package.json` saved                         | `VersionService` watcher                         | `refresh()` → re-detects version → fires `onDidChange`      |
| `nuxtUiCodeLens.version` setting changed     | `VersionService`                                 | Same as above                                               |
| `nuxtUiCodeLens.codeLens.enabled` changed    | `registerProviders` config listener              | `codeLens.refresh()` clears & redraws lenses                |
| Document opens / changes                     | `provideCodeLenses()`                            | Scans file, returns one `$(telescope)` lens per tag found   |
| User clicks `$(telescope)` lens              | `nuxtUiCodeLens.openDocPanel`                    | Focuses sidebar & opens docs panel with insertion context   |
| Source document changes while panel is open  | `onDidChangeTextDocument` (debounced 120 ms)     | Recomputes used attrs → `postMessage({ syncUsed })`         |
| User clicks slot button in webview           | `insertSlot` message → `insertSlot()`            | Injects `<template #name>…</template>` in the editor        |
| User clicks prop button in webview           | `insertProp` message → `insertProp()`            | Injects `:prop-name=""` attribute in the editor             |
| User clicks event button in webview          | `insertEvent` message → `insertEvent()`          | Injects `@event-name=""` attribute in the editor            |
| User clicks v-model button in webview        | `insertVModel` message → `insertVModel()`        | Injects `v-model[:name]=""` in the editor                   |
| User clicks UI key button in webview         | `insertUiKey` message → `insertUiKey()`          | Injects key inside `:ui="{ ... }"`                          |
| User clicks remove (×) button in webview     | `removeAttr` message → `removeAttribute()`       | Removes the matching prop / event / v-model attribute       |
| Webview view disposed                        | `webviewView.onDidDispose()`                     | Clears change listener and debounce timer                   |

---

## Features & Key Functions

### `activate` — [src/extension.ts](src/extension.ts)

Entry point called once when the extension activates. Delegates heavy lifting to dedicated activation modules.

| Step | Call                                          | Role                                                         |
| ---- | --------------------------------------------- | ------------------------------------------------------------ |
| 1    | `new VersionService()`                        | Resolves Nuxt UI version from `package.json` or settings     |
| 2    | `new DocPanel(version)`                       | Creates the sidebar webview panel instance                   |
| 3    | `registerWebviewViewProvider(DocPanel.VIEW_ID, panel)` | Mounts the panel in the Activity Bar sidebar          |
| 4    | `registerProviders(context)`                  | Registers CodeLens provider and config listener              |
| 5    | `registerCommands(context, panel)`            | Registers the `openDocPanel` command                         |

---

### Activation — [src/activation/](src/activation/)

| File                                                        | Role                                                                                                                          |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| [registerProviders.ts](src/activation/registerProviders.ts) | Registers `NuxtUiCodeLensProvider` against `{ language: 'vue', scheme: 'file' }`; wires the `nuxtUiCodeLens.codeLens.enabled` config listener |
| [registerCommands.ts](src/activation/registerCommands.ts)   | Registers the single `Commands.OpenDocPanel` command, which calls `panel.openComponent(ctx)`                                  |

---

### Version Service — [src/version/](src/version/)

Detects which Nuxt UI version the workspace uses and emits a change event when it switches.

| Function / Method         | File                                                             | Role                                                                                          |
| ------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `VersionService`          | [VersionService.ts](src/version/VersionService.ts)               | Watches `**/package.json` and the `nuxtUiCodeLens.version` setting; exposes `current` + `onDidChange` |
| `refresh()`               | [VersionService.ts](src/version/VersionService.ts)               | Re-runs detection and fires `onDidChange` if version changed                                  |
| `detectFromPackageJson()` | [detectFromPackageJson.ts](src/version/detectFromPackageJson.ts) | Walks workspace folders, reads `@nuxt/ui` dep, returns `VersionInfo`                          |
| `parseMajor(range)`       | [parseMajor.ts](src/version/parseMajor.ts)                       | Extracts major number from a semver range (`^4.0.0` → `4`)                                    |

Resolution order (in `VersionService.resolve()`):

1. `nuxtUiCodeLens.version` setting if `v3` or `v4`
2. `@nuxt/ui` major from workspace `package.json`
3. Default: v4 (`https://ui.nuxt.com`); v3 maps to `https://ui3.nuxt.com`

---

### CodeLens Provider — [src/providers/CodeLensProvider.ts](src/providers/CodeLensProvider.ts)

Places a clickable `$(telescope) ComponentName` lens above every line that contains a Nuxt UI opening tag.

| Function / Method         | Role                                                                  |
| ------------------------- | --------------------------------------------------------------------- |
| `provideCodeLenses(document)` | Scans the document via `scanComponents()`, returns one `CodeLens` per tag found |
| `refresh()`               | Fires `_onDidChange` to force VS Code to re-request all lenses        |
| `dispose()`               | Cleans up the internal `EventEmitter`                                 |

Each lens carries the `nuxtUiCodeLens.openDocPanel` command with `[tagName, document.uri.toString(), tagOffset]` so clicking it opens the sidebar panel with full insertion context.

---

### Sidebar Panel — [src/webview/DocPanel.ts](src/webview/DocPanel.ts)

A `WebviewViewProvider` registered in the Activity Bar sidebar. Shows the Nuxt UI component info (slots, props, events, v-models, ui keys) and provides insertion buttons.

| Function / Method                  | Role                                                                                              |
| ---------------------------------- | ------------------------------------------------------------------------------------------------- |
| `resolveWebviewView(view, …)`      | Called by VS Code to initialize the webview; registers message handler and dispose cleanup        |
| `openComponent(context)`           | Stores the `ComponentTagFileContext`, focuses the sidebar, triggers `updatePanel()`               |
| `updatePanel()`                    | Resolves URL + `ComponentInfo`, sets webview title and HTML, starts the change listener           |
| `setupChangeListener()`            | Watches `onDidChangeTextDocument` (debounced 120 ms) to keep "used" attr highlights in sync       |
| `scheduleSync()` / `syncUsed()`    | Recomputes used attributes and pushes a `syncUsed` message to the webview without a full reload   |
| `computeUsedSync()`                | Parses the current opening tag via `parseAttributes()` and `detectUsed()` to find which attrs are already set |

**Message loop** (webview ↔ extension):

```
webview button click
  → postMessage({ command: 'insertSlot' | 'insertProp' | 'insertEvent' | 'insertVModel' | 'insertUiKey' | 'removeAttr', … })
    → DocPanel.onDidReceiveMessage
      → insertSlot() | insertProp() | insertEvent() | insertVModel() | insertUiKey() | removeAttribute()
        → workspace.applyEdit() writes to the source document

extension (on document change)
  → postMessage({ command: 'syncUsed', used: { props, events, vModels } })
    → webview updates "used" CSS classes on buttons (no full re-render)
```

The webview's HTML and helper files:

| File                                                               | Role                                                                                                                     |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| [resolveComponentInfo.ts](src/webview/resolveComponentInfo.ts)     | Calls `vscode.executeDefinitionProvider` to find the `.vue` file, then `readComponentInfo()` on the adjacent `.vue.d.ts` |
| [urls.ts](src/webview/urls.ts)                                     | `componentPath(version, slug)` → `/docs/components/<slug>` (v4) or `/components/<slug>` (v3)                             |
| [html/renderHtml.ts](src/webview/html/renderHtml.ts)               | Builds full webview HTML: CSP header, all accordion sections                                                             |
| [html/renderSection.ts](src/webview/html/renderSection.ts)         | Renders one accordion section (slots / props / events / ui)                                                              |
| [html/renderVModelsSection.ts](src/webview/html/renderVModelsSection.ts) | Renders the v-model accordion section, with sub-items for v-model / :prop / @update: variants              |
| [html/renderPlaceholder.ts](src/webview/html/renderPlaceholder.ts) | Empty-state HTML shown before any component is opened                                                                    |
| [html/escape.ts](src/webview/html/escape.ts)                       | `escapeHtml()` and `escapeAttr()` helpers                                                                                |
| [html/styles.ts](src/webview/html/styles.ts)                       | Inlined CSS string                                                                                                       |
| [html/webviewScript.ts](src/webview/html/webviewScript.ts)         | Inlined webview-side JS (accordion toggle + button click → `postMessage` + `syncUsed` → update CSS classes)              |

---

### Commands — [src/commands/](src/commands/)

Command IDs are centralized in the `Commands` enum to avoid string drift.

| Command ID                    | Source                                                        | Role                                                                            |
| ----------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `nuxtUiCodeLens.openDocPanel` | [registerCommands.ts](src/activation/registerCommands.ts)     | Opens the sidebar panel with full `ComponentTagFileContext` (tagName + uri + offset) |

`openDocPanel` receives `(tagName: string, docUriStr: string, tagOffset: number)` from the CodeLens click and converts them into a `ComponentTagFileContext` before calling `panel.openComponent(ctx)`.

---

### Parsing — [src/parsing/](src/parsing/)

Lightweight regex / state-machine helpers — no full HTML/Vue parser is used.

| Function                                         | File                                                                   | Role                                                                                                                   |
| ------------------------------------------------ | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `scanComponents(document, range?)`               | [scanComponents.ts](src/parsing/scanComponents.ts)                     | Runs `/<(U[A-Z][A-Za-z0-9]*)\b/g`, validates each match against `isNuxtUiTag()`, returns `{ tagName, range, start }[]` |
| `getParsedTag(text, tagStart, tagName)`           | [getParseTag.ts](src/parsing/getParseTag.ts)                           | String-aware scan of the opening tag; returns `{ openTagEnd, selfClosing, closeCharIdx }`                              |
| `parseAttributes(openTagText, tagName)`          | [parseAttributes.ts](src/parsing/parseAttributes.ts)                   | Parses raw attribute list from an opening tag text; returns `ParsedAttribute[]`                                        |
| `classifyAttribute(rawName)`                     | [parseAttributes.ts](src/parsing/parseAttributes.ts)                   | Maps a raw attribute name to `{ kind: 'prop' \| 'event' \| 'vmodel', key }`                                           |
| `detectUsed(attrs)`                              | [parseAttributes.ts](src/parsing/parseAttributes.ts)                   | Aggregates classified attributes into `UsedAttrs` (props / events / vModels sets)                                     |
| `findMatchingCloseTag(text, tagName, fromIndex)` | [findMatchingCloseTag.ts](src/parsing/findMatchingCloseTag.ts)         | Depth-aware finder for the matching `</Tag>` (handles nested same-name tags)                                           |
| `toKebabCase(name)`                              | [caseUtils.ts](src/parsing/caseUtils.ts)                               | `PascalCase` → `kebab-case`                                                                                            |
| `tagToSlug(tagName)`                             | [caseUtils.ts](src/parsing/caseUtils.ts)                               | Validates `UFoo` and converts to `foo` URL slug                                                                        |

---

### Editor Helpers — [src/editor/](src/editor/)

Bridges between scan results and the live VS Code document.

| Function                                           | File                                                | Role                                                                                               |
| -------------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `findComponentAt(document, position)`              | [findComponentAt.ts](src/editor/findComponentAt.ts) | Scans the current line and returns the `ComponentMatch` whose name range contains `position`       |
| `getTagContext({documentUri, tagOffset, tagName})` | [getTagContext.ts](src/editor/getTagContext.ts)      | Opens the document, parses the opening tag, returns `{ document, text, tag }` (or shows a warning) |
| `getLineIndentation(document, line)`               | [indentation.ts](src/editor/indentation.ts)         | Returns the leading whitespace of `line`                                                           |

---

### Insertions — [src/insertions/](src/insertions/)

Each function takes a `ComponentTagFileContext` plus the value to insert and applies a `WorkspaceEdit`.

| Function                       | File                                               | Role                                                                                                                                                                 |
| ------------------------------ | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `insertSlot(ctx, slotName, binding?)` | [insertSlot.ts](src/insertions/insertSlot.ts) | If self-closing: replaces `/>` with full open/close + slot. Otherwise: inserts `<template #name>…</template>` before the matching close, skipping if already present |
| `insertProp(ctx, propName, value?)` | [insertProp.ts](src/insertions/insertProp.ts) | Injects `:prop-name=""` before `>` / `/>`; skips if already set; preserves spacing                                                                                   |
| `insertEvent(ctx, eventName)`  | [insertEvent.ts](src/insertions/insertEvent.ts)    | Injects `@event-name=""` before `>` / `/>`; skips if already set                                                                                                    |
| `insertVModel(ctx, propName)`  | [insertVModel.ts](src/insertions/insertVModel.ts)  | Injects `v-model` (for `modelValue`) or `v-model:name=""` before `>` / `/>`; skips if already set                                                                   |
| `insertUiKey(ctx, keyName)`    | [insertUiKey.ts](src/insertions/insertUiKey.ts)    | If no `:ui`: adds `:ui="{ key: '' }"`. Otherwise: appends `key: ''` inside the existing object; skips if already present                                             |
| `removeAttribute(ctx, kind, key)` | [removeAttribute.ts](src/insertions/removeAttribute.ts) | Removes the full attribute span (including leading whitespace) for the matching prop / event / v-model                                                      |

---

### Component Registry — [src/core/components.ts](src/core/components.ts)

Static data and utilities for the supported Nuxt UI components (Elements, Content, Page, Dashboard categories).

| Export                 | Role                                                                                                           |
| ---------------------- | -------------------------------------------------------------------------------------------------------------- |
| `NUXT_UI_COMPONENTS`   | Array of component names without `U` prefix                                                                    |
| `NUXT_UI_TAG_NAMES`    | Array of full tag names (`UCard`, `UButton`, …)                                                                |
| `isNuxtUiTag(tagName)` | O(1) lookup via internal `Set` (marked `@deprecated` — eventually to be replaced with package-aware detection) |

---

### Type Info Resolution — [src/typeInfo/](src/typeInfo/)

Slots, props, events, v-models, and `:ui` keys are resolved by **delegating to the active TypeScript / Volar language server** rather than parsing `.d.ts` files manually.

| Function                                   | File                                                                | Role                                                                                                           |
| ------------------------------------------ | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `resolveDeclarationPath(definitionFsPath)` | [resolveDeclarationPath.ts](src/typeInfo/resolveDeclarationPath.ts) | Maps the path returned by the definition provider to the adjacent `.vue.d.ts`                                  |
| `readComponentInfo(declarationFilePath)`   | [readComponentInfo.ts](src/typeInfo/readComponentInfo.ts)           | Calls `vscode.executeDocumentSymbolProvider` to enumerate `*Slots` / `*Props` / `*Emits` interface members; also resolves variant values from the theme file |
| `resolveUiKeys(uri)`                       | [resolveUiKeys.ts](src/typeInfo/resolveUiKeys.ts)                   | Follows the `theme` import in the declaration file and extracts `:ui` keys from document symbols               |

`readComponentInfo` returns a `ComponentInfo` object with:
- **slots** — `SlotInfo[]` (name + slot binding keys)
- **props** — `PropInfo[]` (name + allowed variant values when applicable)
- **events** — `string[]` (from `*Emits` symbols and `onXxx` props)
- **vModels** — `VModelInfo[]` (derived from `update:*` events)
- **uiKeys** — `string[]`

End-to-end resolution flow (when the user clicks a CodeLens):

```
ComponentTagFileContext (uri + offset + tagName)
  → vscode.executeDefinitionProvider  → .vue file path
  → resolveDeclarationPath            → .vue.d.ts file path
  → vscode.executeDocumentSymbolProvider  → Props / Slots / Emits interface symbols
  → resolveVariantValues via executeDefinitionProvider on theme import → variant values
  → resolveUiKeys via executeDocumentSymbolProvider on theme file → :ui key list
  → ComponentInfo { slots, props, events, vModels, uiKeys }
```

This approach automatically picks up whatever package manager layout is in use (npm / pnpm / Yarn Berry PnP) because the language server already knows where to find the types.

---

## Settings Reference

| Setting                          | Type                     | Default  | Effect                                                        |
| -------------------------------- | ------------------------ | -------- | ------------------------------------------------------------- |
| `nuxtUiCodeLens.version`         | `"auto" \| "v3" \| "v4"` | `"auto"` | Forces a specific docs version; `"auto"` reads `package.json` |
| `nuxtUiCodeLens.codeLens.enabled` | `boolean`               | `true`   | Shows / hides `$(telescope)` CodeLens above component tags    |
