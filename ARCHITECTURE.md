# Architecture & Feature Map

Overview of how the Nuxt UI VS Code extension works internally: lifecycle phases, features, and key functions.

---

## File Structure

```
src/
├── extension.ts                       # Entry point — activate / deactivate
├── activation/
│   ├── registerProviders.ts           # Registers inlay hints + hover providers
│   └── registerCommands.ts            # Registers public + internal commands
├── commands/
│   ├── commandIds.enum.ts             # Single source of truth for command IDs
│   ├── componentMenu.ts               # Action menu trigger for a single component
│   └── openComponent.ts               # QuickPick to pick any component
├── core/
│   ├── components.ts                  # Static registry of 81 Nuxt UI components
│   └── types.ts                       # Shared type definitions
├── editor/
│   ├── findComponentAt.ts             # Locate the component tag at a given position
│   ├── getTagContext.ts               # Open document + parse the opening tag
│   └── indentation.ts                 # Read leading whitespace of a line
├── insertions/
│   ├── insertSlot.ts                  # Inject <template #name> in the editor
│   ├── insertProp.ts                  # Inject :prop="" in the editor
│   └── insertUiKey.ts                 # Inject key inside :ui="{ … }"
├── parsing/
│   ├── caseUtils.ts                   # PascalCase ↔ kebab-case + tag → URL slug
│   ├── findMatchingCloseTag.ts           # Depth-aware </Tag> finder
│   ├── parseTag.ts                    # Find the end of an opening tag (string-aware)
│   └── scanComponents.ts              # Regex scanner for <U…> tags
├── providers/
│   ├── HoverProvider.ts               # Hover tooltip provider
│   └── InlayHintsProvider.ts          # ⚡ inlay hints provider
├── typeInfo/
│   ├── readComponentInfo.ts           # Extracts slots / props / ui keys via DocumentSymbolProvider
│   ├── resolveDeclarationPath.ts      # Maps `.vue` → `.vue.d.ts`
│   └── resolveUiKeys.ts               # Extracts `:ui` keys from a TS hover tooltip
├── version/
│   ├── VersionService.ts              # Detects & watches Nuxt UI version (v3 / v4)
│   ├── detectFromPackageJson.ts       # Reads `@nuxt/ui` from workspace package.json
│   └── parseMajor.ts                  # Extracts the major number from a semver range
└── webview/
    ├── DocPanel.ts                    # Reusable webview (docs iframe + insertion UI)
    ├── resolveComponentInfo.ts        # Calls TS definition provider, then readComponentInfo
    ├── urls.ts                        # Builds doc paths for v3 / v4
    └── html/
        ├── renderHtml.ts              # Top-level HTML template (CSP, sections, iframe)
        ├── renderSection.ts           # One accordion section (slots / props / ui)
        ├── escape.ts                  # HTML / attribute escaping helpers
        ├── styles.ts                  # Inlined CSS string
        └── webviewScript.ts           # Inlined webview-side JS (button → postMessage)
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
│  1. new VersionService()          resolve & watch version           │
│  2. new DocPanel(version)         create reusable webview           │
│  3. registerProviders(context)    register ⚡ hints + hover         │
│  4. registerCommands(context)     wire up all commands              │
└─────────────────────────────────────────────────────────────────────┘
        │
        │  (user edits, hovers, clicks — see Runtime section)
        │
VS Code closes all .vue files
        │
        ▼
┌──────────────────────────────────────────────┐
│  deactivate()  (no-op)                       │
│  All context.subscriptions auto-disposed     │
└──────────────────────────────────────────────┘
```

---

## Runtime Event Map

| Trigger                                   | Handler                                            | Action                                                 |
| ----------------------------------------- | -------------------------------------------------- | ------------------------------------------------------ |
| `.vue` file opened                        | `activate()`                                       | Registers all providers & commands                     |
| `package.json` saved                      | `VersionService` watcher                           | `refresh()` → re-detects version → fires `onDidChange` |
| `nuxtUi.version` setting changed          | `VersionService`                                   | Same as above                                          |
| `nuxtUi.inlayHints.enabled` changed       | `registerProviders` config listener                | `inlayHints.refresh()` clears & redraws hints          |
| Cursor enters view range                  | `provideInlayHints()`                              | Scans range, returns `⚡` hints for each tag found     |
| Mouse hovers `<UComponent>`               | `provideHover()`                                   | Renders Markdown tooltip with doc & menu links         |
| User clicks `⚡` hint                     | `nuxtUiHelper.openFromVSCode`                      | Opens docs panel with full insertion context           |
| User clicks "Open documentation" in hover | `nuxtUi.openComponentByName`                       | Opens docs panel for that component (no insertion ctx) |
| User clicks "More actions…" in hover      | `nuxtUiHelper.showComponentMenu`                   | Opens docs panel for that component                    |
| User picks component from QuickPick       | `pickAndOpenComponent()` → `panel.openComponent()` | Opens docs panel without insertion UI                  |
| User clicks slot button in webview        | `insertSlot` message → `insertSlot()`              | Injects `<template #name>` in the editor               |
| User clicks prop button in webview        | `insertProp` message → `insertProp()`              | Injects `:prop-name=""` attribute in the editor        |
| User clicks UI key button in webview      | `insertUiKey` message → `insertUiKey()`            | Injects key inside `:ui="{ ... }"`                     |
| Webview panel closed                      | `panel.onDidDispose()`                             | Clears internal panel & context references             |

---

## Features & Key Functions

### `activate` — [src/extension.ts](src/extension.ts)

Entry point called once when the first `.vue` file is opened. Delegates the heavy lifting to dedicated activation modules.

| Step | Call                               | Role                                                       |
| ---- | ---------------------------------- | ---------------------------------------------------------- |
| 1    | `new VersionService()`             | Resolves Nuxt UI version from `package.json` or settings   |
| 2    | `new DocPanel(version)`            | Creates the reusable webview panel instance                |
| 3    | `registerProviders(context)`       | Registers inlay hint + hover providers and config listener |
| 4    | `registerCommands(context, panel)` | Registers all user-facing and internal commands            |

---

### Activation — [src/activation/](src/activation/)

| File                                                        | Role                                                                                                                                                                   |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [registerProviders.ts](src/activation/registerProviders.ts) | Registers `NuxtUiInlayHintsProvider` + `NuxtUiHoverProvider` against `{ language: 'vue', scheme: 'file' }`; also wires the `nuxtUi.inlayHints.enabled` config listener |
| [registerCommands.ts](src/activation/registerCommands.ts)   | Registers all 5 commands declared in `Commands` enum (3 public + 2 internal)                                                                                           |

---

### Version Service — [src/version/](src/version/)

Detects which Nuxt UI version the workspace uses and emits a change event when it switches.

| Function / Method         | File                                                             | Role                                                                                          |
| ------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `VersionService`          | [VersionService.ts](src/version/VersionService.ts)               | Watches `**/package.json` and the `nuxtUi.version` setting; exposes `current` + `onDidChange` |
| `refresh()`               | [VersionService.ts](src/version/VersionService.ts)               | Re-runs detection and fires `onDidChange` if version changed                                  |
| `detectFromPackageJson()` | [detectFromPackageJson.ts](src/version/detectFromPackageJson.ts) | Walks workspace folders, reads `@nuxt/ui` dep, returns `VersionInfo`                          |
| `parseMajor(range)`       | [parseMajor.ts](src/version/parseMajor.ts)                       | Extracts major number from a semver range (`^4.0.0` → `4`)                                    |

Resolution order (in `VersionService.resolve()`):

1. `nuxtUi.version` setting if `v3` or `v4`
2. `@nuxt/ui` major from workspace `package.json`
3. Default: v4 (`https://ui.nuxt.com`); v3 maps to `https://ui3.nuxt.com`

---

### Inlay Hints Provider — [src/providers/InlayHintsProvider.ts](src/providers/InlayHintsProvider.ts)

Places a clickable `⚡` glyph before every Nuxt UI opening tag in the visible range.

| Function / Method                    | Role                                                                 |
| ------------------------------------ | -------------------------------------------------------------------- |
| `provideInlayHints(document, range)` | Scans the visible range, returns one `InlayHint` per component found |
| `refresh()`                          | Fires `_onDidChange` to force VS Code to re-request all hints        |
| `dispose()`                          | Cleans up the internal `EventEmitter`                                |

Each hint carries the `nuxtUiHelper.openFromVSCode` command with `[tagName, document.uri.toString(), tagOffset]` so clicking it opens the docs panel with full insertion context.

---

### Hover Provider — [src/providers/HoverProvider.ts](src/providers/HoverProvider.ts)

Shows a tooltip with action links when hovering over a `<UComponent>` tag.

| Function / Method                  | Role                                                                                                             |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `provideHover(document, position)` | Detects the tag under the cursor via `findComponentAt()`, builds a Markdown hover with two trusted command links |

The tooltip contains: **Open documentation** (`nuxtUi.openComponentByName`) and **More actions…** (`nuxtUiHelper.showComponentMenu`).

---

### Webview Panel — [src/webview/DocPanel.ts](src/webview/DocPanel.ts)

A single reusable `WebviewPanel` that embeds the Nuxt UI docs in an iframe and provides slot / prop / UI-key insertion buttons.

| Function / Method                  | Role                                                                                              |
| ---------------------------------- | ------------------------------------------------------------------------------------------------- |
| `openComponent(tagName, context?)` | Resolves slug + URL, fetches `ComponentInfo` (when `context` is set), creates / updates the panel |
| `initPanel(title)`                 | Lazily creates the panel, registers the `onDidReceiveMessage` handler + `onDidDispose` cleanup    |
| `updatePanel(title, url, info)`    | Updates title, reveals panel, regenerates HTML via `renderHtml()`                                 |

The webview's HTML and message helpers live in dedicated files:

| File                                                           | Role                                                                                                                     |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| [resolveComponentInfo.ts](src/webview/resolveComponentInfo.ts) | Calls `vscode.executeDefinitionProvider` to find the `.vue` file, then `readComponentInfo()` on the adjacent `.vue.d.ts` |
| [urls.ts](src/webview/urls.ts)                                 | `componentPath(version, slug)` → `/docs/components/<slug>` (v4) or `/components/<slug>` (v3)                             |
| [html/renderHtml.ts](src/webview/html/renderHtml.ts)           | Builds full webview HTML: CSP header, three accordion sections (props / ui / slots), iframe                              |
| [html/renderSection.ts](src/webview/html/renderSection.ts)     | Renders one accordion section (header + button list or empty state)                                                      |
| [html/escape.ts](src/webview/html/escape.ts)                   | `escapeHtml()` and `escapeAttr()` helpers                                                                                |
| [html/styles.ts](src/webview/html/styles.ts)                   | Inlined CSS string                                                                                                       |
| [html/webviewScript.ts](src/webview/html/webviewScript.ts)     | Inlined webview-side JS (accordion toggle + button click → `postMessage`)                                                |

**Message loop** (webview → extension):

```
webview button click
  → postMessage({ command: 'insertSlot' | 'insertProp' | 'insertUiKey', … })
    → DocPanel.onDidReceiveMessage
      → insertSlot() | insertProp() | insertUiKey()
        → workspace.applyEdit() writes to the source document
```

---

### Commands — [src/commands/](src/commands/)

Command IDs are centralized in the `Commands` enum to avoid string drift.

| Command ID                       | Source                                                    | Role                                                                            |
| -------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `nuxtUiHelper.openHome`          | [commandIds.enum.ts](src/commands/commandIds.enum.ts)     | Reserved for the home panel (currently a no-op handler)                         |
| `nuxtUiHelper.openComponent`     | [openComponent.ts](src/commands/openComponent.ts)         | Shows a searchable QuickPick of all known components                            |
| `nuxtUiHelper.showComponentMenu` | [componentMenu.ts](src/commands/componentMenu.ts)         | Opens the docs panel for a tag, with insertion UI when context is provided      |
| `nuxtUi.openComponentByName`     | [registerCommands.ts](src/activation/registerCommands.ts) | Internal — opens the panel from the hover tooltip (no insertion ctx)            |
| `nuxtUiHelper.openFromVSCode`    | [registerCommands.ts](src/activation/registerCommands.ts) | Internal — wired to the inlay hint click; passes full `ComponentTagFileContext` |

`showComponentMenu` and `openFromVSCode` receive a `ComponentTagFileContext` (`documentUri` + `tagOffset` + `tagName`) so the insertion functions know exactly where to write in the source file.

---

### Parsing — [src/parsing/](src/parsing/)

Lightweight regex / state-machine helpers — no full HTML/Vue parser is used.

| Function                                         | File                                                                   | Role                                                                                                                   |
| ------------------------------------------------ | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `scanComponents(document, range?)`               | [scanComponents.ts](src/parsing/scanComponents.ts)                     | Runs `/<(U[A-Z][A-Za-z0-9]*)\b/g`, validates each match against `isNuxtUiTag()`, returns `{ tagName, range, start }[]` |
| `getParsedTag(text, tagStart, tagName)`          | [parseTag.ts](src/parsing/parseTag.ts)                                 | String-aware scan of the opening tag; returns `{ openTagEnd, selfClosing, closeCharIdx }`                              |
| `findMatchingCloseTag(text, tagName, fromIndex)` | [parsing/findMatchingCloseTag.ts](src/parsing/findMatchingCloseTag.ts) | Depth-aware finder for the matching `</Tag>` (handles nested same-name tags)                                           |
| `toKebabCase(name)`                              | [caseUtils.ts](src/parsing/caseUtils.ts)                               | `PascalCase` → `kebab-case`                                                                                            |
| `tagToSlug(tagName)`                             | [caseUtils.ts](src/parsing/caseUtils.ts)                               | Validates `UFoo` and converts to `foo` URL slug                                                                        |

---

### Editor Helpers — [src/editor/](src/editor/)

Bridges between scan results and the live VS Code document.

| Function                                           | File                                                | Role                                                                                               |
| -------------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `findComponentAt(document, position)`              | [findComponentAt.ts](src/editor/findComponentAt.ts) | Scans the current line and returns the `ComponentMatch` whose name range contains `position`       |
| `getTagContext({documentUri, tagOffset, tagName})` | [getTagContext.ts](src/editor/getTagContext.ts)     | Opens the document, parses the opening tag, returns `{ document, text, tag }` (or shows a warning) |
| `getLineIndentation(document, line)`               | [indentation.ts](src/editor/indentation.ts)         | Returns the leading whitespace of `line`                                                           |

---

### Insertions — [src/insertions/](src/insertions/)

Each function takes a `ComponentTagFileContext` + the value to insert and applies a `WorkspaceEdit`.

| Function                    | File                                            | Role                                                                                                                                                                 |
| --------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `insertSlot(ctx, slotName)` | [insertSlot.ts](src/insertions/insertSlot.ts)   | If self-closing: replaces `/>` with full open/close + slot. Otherwise: inserts `<template #name>…</template>` before the matching close, skipping if already present |
| `insertProp(ctx, propName)` | [insertProp.ts](src/insertions/insertProp.ts)   | Injects `:prop-name=""` before `>` / `/>`; skips if already set; preserves spacing                                                                                   |
| `insertUiKey(ctx, keyName)` | [insertUiKey.ts](src/insertions/insertUiKey.ts) | If no `:ui`: adds `:ui="{ key: '' }"`. Otherwise: appends `key: ''` inside the existing object; skips if already present                                             |

---

### Component Registry — [src/core/components.ts](src/core/components.ts)

Static data and utilities for the supported Nuxt UI components (Elements, Content, Page, Dashboard categories).

| Export                 | Role                                                                                                           |
| ---------------------- | -------------------------------------------------------------------------------------------------------------- |
| `NUXT_UI_COMPONENTS`   | Array of component names without `U` prefix (~80 entries)                                                      |
| `NUXT_UI_TAG_NAMES`    | Array of full tag names (`UCard`, `UButton`, …)                                                                |
| `isNuxtUiTag(tagName)` | O(1) lookup via internal `Set` (marked `@deprecated` — eventually to be replaced with package-aware detection) |

---

### Type Info Resolution — [src/typeInfo/](src/typeInfo/)

Slots, props, and `:ui` keys are resolved by **delegating to the active TypeScript / Volar language server** rather than parsing `.d.ts` files manually.

| Function                                   | File                                                                | Role                                                                                                           |
| ------------------------------------------ | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `resolveDeclarationPath(definitionFsPath)` | [resolveDeclarationPath.ts](src/typeInfo/resolveDeclarationPath.ts) | Maps the path returned by the definition provider to the adjacent `.vue.d.ts`                                  |
| `readComponentInfo(declarationFilePath)`   | [readComponentInfo.ts](src/typeInfo/readComponentInfo.ts)           | Calls `vscode.executeDocumentSymbolProvider` to enumerate `*Slots` / `*Props` interface members                |
| `resolveUiKeys(uri, position)`             | [resolveUiKeys.ts](src/typeInfo/resolveUiKeys.ts)                   | Calls `vscode.executeHoverProvider` on the `ui` property and parses the inline object type from the hover text |

End-to-end resolution flow (when the user clicks `⚡` or "More actions…"):

```
ComponentTagFileContext (uri + offset + tagName)
  → vscode.executeDefinitionProvider  → .vue file path
  → resolveDeclarationPath            → .vue.d.ts file path
  → vscode.executeDocumentSymbolProvider  → Props / Slots interface symbols
  → vscode.executeHoverProvider on `ui`   → :ui key list
  → ComponentInfo { slots, props, uiKeys }
```

This approach automatically picks up whatever package manager layout is in use (npm / pnpm / Yarn Berry PnP) because the language server already knows where to find the types.

---

## Settings Reference

| Setting                     | Type                     | Default  | Effect                                                        |
| --------------------------- | ------------------------ | -------- | ------------------------------------------------------------- |
| `nuxtUi.version`            | `"auto" \| "v3" \| "v4"` | `"auto"` | Forces a specific docs version; `"auto"` reads `package.json` |
| `nuxtUi.inlayHints.enabled` | `boolean`                | `true`   | Shows / hides `⚡` inlay hints                                |
| `nuxtUi.hover.enabled`      | `boolean`                | `true`   | Shows / hides hover tooltips                                  |
