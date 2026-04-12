# Architecture & Feature Map

Overview of how the Nuxt UI VS Code extension works internally: lifecycle phases, features, and key functions.

---

## File Structure

```
src/
├── extension.ts              # Entry point — activate / deactivate
├── components.ts             # Component registry (98 components)
├── scanner.ts                # Regex scanner for <U…> tags in documents
├── slots.ts                  # Extracts slots / props / ui keys from type declarations
├── version.ts                # Detects & watches Nuxt UI version (v3 / v4)
├── commands/
│   ├── componentMenu.ts      # QuickPick context menu for a single component
│   └── openComponent.ts      # QuickPick to pick any component
├── providers/
│   ├── hover.ts              # Hover tooltip provider
│   └── inlayHints.ts         # ⚡ inlay hints provider
└── webview/
    └── panel.ts              # Webview panel (docs iframe + insertion UI)
```

---

## Extension Lifecycle

```
VS Code opens a .vue file
        │
        ▼
┌─────────────────────────────────────────────────────────────────────┐
│  activate(context)                                                  │
│                                                                     │
│  1. new VersionService()          resolve & watch version           │
│  2. new DocPanel(version)         create reusable webview           │
│  3. new NuxtUiInlayHintsProvider  register ⚡ hints                 │
│  4. new NuxtUiHoverProvider       register hover tooltips           │
│  5. onDidChangeConfiguration      refresh hints on setting change   │
│  6. registerCommand ×4            wire up all commands              │
└─────────────────────────────────────────────────────────────────────┘
        │
        │  (user edits, hovers, clicks — see Runtime section)
        │
VS Code closes all .vue files
        │
        ▼
┌──────────────────────────────────────────────┐
│  deactivate()  (implicit)                    │
│  All context.subscriptions auto-disposed     │
└──────────────────────────────────────────────┘
```

---

## Runtime Event Map

| Trigger | Handler | Action |
|---------|---------|--------|
| `.vue` file opened | `activate()` | Registers all providers & commands |
| `package.json` saved | `VersionService` watcher | `refresh()` → re-detects version → webview re-renders |
| `nuxtUi.version` setting changed | `VersionService` | Same as above |
| `nuxtUi.inlayHints.enabled` changed | `onDidChangeConfiguration` | `inlayHints.refresh()` clears & redraws hints |
| Cursor enters view range | `provideInlayHints()` | Scans range, returns `⚡` hints for each tag found |
| Mouse hovers `<UComponent>` | `provideHover()` | Renders Markdown tooltip with doc & menu links |
| User clicks `⚡` hint | `nuxtUi.showComponentMenu` | Opens QuickPick context menu |
| User clicks "Open documentation" in hover | `nuxtUi.openComponentByName` | Opens docs panel for that component |
| User clicks "More actions…" in hover | `nuxtUi.showComponentMenu` | Opens QuickPick context menu |
| User picks component from QuickPick | `panel.openComponent()` | Opens docs panel, renders slot/prop/ui insertion UI |
| User clicks slot button in webview | `insertSlot` message → `handleInsertSlot()` | Injects `<template #name>` in the editor |
| User clicks prop button in webview | `insertProp` message → `handleInsertProp()` | Injects `:prop-name=""` attribute in the editor |
| User clicks UI key button in webview | `insertUiKey` message → `handleInsertUiKey()` | Injects key inside `:ui="{ ... }"` |
| Webview panel closed | `panel.onDidDispose()` | Clears internal panel reference |

---

## Features & Key Functions

### `activate` — [src/extension.ts](src/extension.ts)

Entry point called once when the first `.vue` file is opened.

| Step | Call | Role |
|------|------|------|
| 1 | `new VersionService()` | Resolves Nuxt UI version from `package.json` or settings |
| 2 | `new DocPanel(version)` | Creates the reusable webview panel instance |
| 3 | `languages.registerInlayHintsProvider` | Activates `⚡` hints for all `.vue` files |
| 4 | `languages.registerHoverProvider` | Activates hover tooltips for all `.vue` files |
| 5 | `workspace.onDidChangeConfiguration` | Refreshes hints when `nuxtUi.inlayHints.enabled` changes |
| 6 | `commands.registerCommand` ×4 | Registers all user-facing and internal commands |

---

### Version Service — [src/version.ts](src/version.ts)

Detects which Nuxt UI version the workspace uses and emits a change event when it switches.

| Function / Method | Role |
|-------------------|------|
| `constructor()` | Sets up file watcher on `**/package.json` and config watcher |
| `refresh()` | Re-runs detection and emits `onDidChange` if version changed |
| `detectFromPackageJson()` | Reads `@nuxt/ui` version from nearest `package.json` |
| `resolve()` | Resolution order: setting → package.json → default (v4) |
| `get baseUrl` | Returns `https://ui3.nuxt.com` (v3) or `https://ui.nuxt.com` (v4) |
| `onDidChange` | Event fired when version switches; `DocPanel` listens to re-render |

---

### Inlay Hints Provider — [src/providers/inlayHints.ts](src/providers/inlayHints.ts)

Places a clickable `⚡` glyph before every Nuxt UI opening tag in the visible range.

| Function / Method | Role |
|-------------------|------|
| `provideInlayHints(document, range)` | Scans the visible range, returns one `InlayHint` per component found |
| `refresh()` | Fires `_onDidChange` to force VS Code to re-request all hints |
| `dispose()` | Cleans up the internal `EventEmitter` |

Each hint carries the `nuxtUi.showComponentMenu` command so clicking it opens the context menu.

---

### Hover Provider — [src/providers/hover.ts](src/providers/hover.ts)

Shows a tooltip with action links when hovering over a `<UComponent>` tag.

| Function / Method | Role |
|-------------------|------|
| `provideHover(document, position)` | Detects the tag under the cursor via `findComponentAt()`, builds a Markdown hover |

The tooltip contains two command links: **Open documentation** and **More actions…**

---

### Webview Panel — [src/webview/panel.ts](src/webview/panel.ts)

A single reusable `WebviewPanel` that embeds the Nuxt UI docs in an iframe and provides slot / prop / UI-key insertion buttons.

| Function / Method | Role |
|-------------------|------|
| `openHome()` | Navigates the panel to the getting-started page |
| `openComponent(tagName, context?)` | Navigates to the component's doc page; if `context` is provided, shows insertion UI |
| `show(title, url, context)` | Creates the panel on first call, then reuses it; registers message handlers |
| `navigate(url, context)` | Reads metadata (slots, props, ui keys) then calls `renderHtml()` |
| `renderHtml(url, context, slots, props, uiKeys)` | Returns the full webview HTML: CSP header, accordion sections, iframe |
| `handleInsertSlot(slotName)` | Delegates to `insertSlot()` — injects `<template #name>` |
| `handleInsertProp(propName)` | Delegates to `insertProp()` — injects `:prop=""` before `>` or `/>` |
| `handleInsertUiKey(keyName)` | Delegates to `insertUiKey()` — injects key inside `:ui="{}"` |

**Message loop** (webview → extension):

```
webview button click
  → postMessage({ command: 'insertSlot' | 'insertProp' | 'insertUiKey', … })
    → onDidReceiveMessage
      → handleInsert*()
        → editor.edit() writes to the active document
```

---

### Commands — [src/commands/](src/commands/)

| Command ID | File | Role |
|------------|------|------|
| `nuxtUi.openHome` | `extension.ts` | Opens the docs home page |
| `nuxtUi.openComponent` | `openComponent.ts` | Shows a searchable QuickPick of all 98 components |
| `nuxtUi.showComponentMenu` | `componentMenu.ts` | Shows a context QuickPick for the tag under cursor |
| `nuxtUi.openComponentByName` | `extension.ts` | Internal — used by hover tooltip links |

`showComponentMenu` receives a `ComponentContext` (document URI + tag offset) so the insertion functions know exactly where to write in the source file.

---

### Scanner — [src/scanner.ts](src/scanner.ts)

Locates Nuxt UI component tags inside a document or range.

| Function | Role |
|----------|------|
| `scanComponents(document, range?)` | Runs `/<(U[A-Z][A-Za-z0-9]*)\b/g` over the text, validates each match against `isNuxtUiTag()`, returns `{ tagName, range, start }[]` |
| `findComponentAt(document, position)` | Scans the current line only and checks if `position` falls within a tag-name span |

---

### Component Registry — [src/components.ts](src/components.ts)

Static data and utilities for the 98 Nuxt UI components.

| Export | Role |
|--------|------|
| `NUXT_UI_COMPONENTS` | Array of component names without `U` prefix |
| `NUXT_UI_TAG_NAMES` | Array of full tag names (`UCard`, `UButton`, …) |
| `isNuxtUiTag(tagName)` | O(1) lookup via `Set` |
| `toKebabCase(name)` | `PascalCase` → `kebab-case` |
| `tagToSlug(tagName)` | Validates + converts to URL slug for docs navigation |

---

### Slots / Props / UI Keys — [src/slots.ts](src/slots.ts)

Extracts metadata from the component's TypeScript declaration files inside `node_modules`.

| Function | Role |
|----------|------|
| `readComponentSlots(componentName)` | Parses `interface ComponentSlots` or `type ComponentSlots` from the `.d.ts` file |
| `readComponentProps(componentName)` | Parses `interface ComponentProps` similarly |
| `readComponentUiKeys(componentName)` | Parses the `:ui` prop's object type to extract its keys |

**Package manager resolution order:**

1. **npm / yarn classic** — walks up the directory tree for `node_modules/@nuxt/ui`
2. **pnpm** — checks `.pnpm/@nuxt+ui@*` virtual store
3. **Yarn Berry (PnP)** — checks `.yarn/unplugged/@nuxt-ui-npm-*`

Candidate `.d.ts` paths tried for each component (flat and nested variants, e.g. `Card.vue.d.ts`, `dashboard/Navbar.vue.d.ts`).

---

## Settings Reference

| Setting | Type | Default | Effect |
|---------|------|---------|--------|
| `nuxtUi.version` | `"auto" \| "v3" \| "v4"` | `"auto"` | Forces a specific docs version; `"auto"` reads `package.json` |
| `nuxtUi.inlayHints.enabled` | `boolean` | `true` | Shows / hides `⚡` inlay hints |
| `nuxtUi.hover.enabled` | `boolean` | `true` | Shows / hides hover tooltips |
