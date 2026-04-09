# Nuxt UI — VS Code Extension

Browse and navigate the [Nuxt UI](https://ui.nuxt.com) documentation directly inside VS Code.

## Features

- **Documentation viewer** — opens the Nuxt UI docs in a dedicated webview panel (iframe), without leaving the editor
- **Component picker** (`Cmd+Shift+P` → *Nuxt UI: Open Component Docs…*) — fuzzy-search any component by name and jump straight to its doc page
- **Inlay hint** — a clickable `⚡` appears before every `<U…>` opening tag in `.vue` files; click it to open a quick-action menu
- **Hover tooltip** — hover over any Nuxt UI tag to get direct links to its documentation
- **Auto version detection** — reads `@nuxt/ui` from the workspace `package.json` and automatically uses the v3 or v4 documentation accordingly

## Commands

| Command | Description |
|---|---|
| `Nuxt UI: Open Documentation Home` | Opens the Nuxt UI docs home page |
| `Nuxt UI: Open Component Docs…` | Fuzzy-search and open any component's doc page |

## Settings

| Setting | Default | Description |
|---|---|---|
| `nuxtUi.version` | `auto` | Force `v3`, `v4`, or let the extension detect from `package.json` |
| `nuxtUi.inlayHints.enabled` | `true` | Show the `⚡` inlay hint next to component tags |
| `nuxtUi.hover.enabled` | `true` | Show the hover tooltip on component tags |

---

## Development

### Prerequisites

- [Bun](https://bun.sh) ≥ 1.0
- [VS Code](https://code.visualstudio.com) ≥ 1.85

### Install dependencies

```bash
bun install
```

### Run the extension locally

1. Open the `nuxt-ui-vscode` folder in VS Code
2. Press **F5** (or go to *Run → Start Debugging*)

VS Code compiles the TypeScript source, then opens a second window called **Extension Development Host** with the extension loaded.

> To reload the extension after a code change, press **Cmd+R** inside the Extension Development Host window.

### Watch mode (recommended during development)

Instead of recompiling manually, run the watcher in a terminal:

```bash
bun run watch
```

Then press **F5**. Every time you save a `.ts` file the extension is recompiled, and **Cmd+R** in the host window picks up the changes.

### Test the features

Open (or create) a `.vue` file in the Extension Development Host window and add a Nuxt UI component tag:

```vue
<template>
  <UButton label="Click me" />
  <UCheckbox v-model="checked" label="Accept" />
</template>
```

You should see:
- A `⚡` hint before each tag — click it to open the quick-action menu
- A tooltip when hovering over `UButton` or `UCheckbox`
- `Cmd+Shift+P` → *Nuxt UI: Open Component Docs…* lists all components

### Compile once

```bash
bun run compile
```

Output is written to the `out/` directory.

### Project structure

```
src/
├── extension.ts          # Entry point — registers all providers and commands
├── components.ts         # Static list of Nuxt UI component names
├── version.ts            # Detects the installed @nuxt/ui version
├── scanner.ts            # Regex scanner for <U…> tags in documents
├── webview/
│   └── panel.ts          # Manages the reusable iframe webview panel
├── providers/
│   ├── inlayHints.ts     # ⚡ inlay hint before each component tag
│   └── hover.ts          # Hover tooltip with action links
└── commands/
    ├── componentMenu.ts  # QuickPick action menu (main extensibility point)
    └── openComponent.ts  # Global component picker for the command palette
```
