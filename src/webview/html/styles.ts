export const STYLES = `
    *, *::before, *::after { box-sizing: border-box; }

    html, body {
      margin: 0;
      padding: 0;
      height: 100%;
      overflow: hidden;
      background: var(--vscode-sideBar-background, var(--vscode-editor-background));
      color: var(--vscode-foreground);
      font-family:  var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol');
      font-size: var(--vscode-font-size, 13px);
    }

    .layout {
      display: flex;
      flex-direction: column;
      height: 100vh;
    }

    /* ---- Treeview section ---- */
    .treeview {
      border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border, var(--vscode-panel-border, transparent));
      flex-shrink: 0;
    }

    .treeview.is-open:not(.docs-section) {
      display: flex;
      flex-direction: column;
      height: var(--section-height, 132px);
      min-height: 44px;
    }

    .treeview-header {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 0 12px;
      height: 22px;
      cursor: pointer;
      user-select: none;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--vscode-sideBarSectionHeader-foreground, var(--vscode-foreground));
      background: var(--vscode-sideBarSectionHeader-background, transparent);
    }

    .treeview-count {
      font-weight: 300;
      opacity: 0.7;
      margin-left: 4px;
    }

    .treeview-header:hover {
      background: var(--vscode-list-hoverBackground, rgba(255,255,255,0.04));
    }

    .treeview-header:focus-visible {
      outline: 1px solid var(--vscode-focusBorder);
      outline-offset: -1px;
    }

    .treeview-chevron {
      font-size: 16px;
      line-height: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      transition: transform 0.1s ease;
    }

    .treeview-chevron::before {
      content: '';
      display: block;
      width: 0;
      height: 0;
      border-left: 5px solid var(--vscode-foreground);
      border-top: 3.5px solid transparent;
      border-bottom: 3.5px solid transparent;
      opacity: 0.8;
    }

    .treeview.is-open > .treeview-header .treeview-chevron {
      transform: rotate(90deg);
    }

    .treeview-body {
      display: none;
    }

    .treeview.is-open > .treeview-body {
      display: block;
      overflow-y: auto;
      flex: 1;
      min-height: 0;
    }

    /* ---- Tree items ---- */
    .tree-list {
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .tree-item {
      display: flex;
      align-items: center;
      height: 22px;
      padding: 0 12px 0 24px;
      cursor: pointer;
      font-family: var(--vscode-font-family, monospace);
      font-size: 13px;
      line-height: 22px;
      color: var(--vscode-foreground);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .tree-item:hover {
      background: var(--vscode-list-hoverBackground, rgba(255,255,255,0.04));
    }

    .tree-item:focus-visible {
      outline: 1px solid var(--vscode-focusBorder);
      outline-offset: -1px;
    }

    .tree-item:active {
      background: var(--vscode-list-activeSelectionBackground);
      color: var(--vscode-list-activeSelectionForeground);
    }

    .tree-item-badge {
      margin-left: auto;
      padding-left: 8px;
      font-weight: 700;
      color: var(--vscode-foreground);
      flex-shrink: 0;
    }

    .tree-empty {
      height: 22px;
      padding: 0 12px 0 24px;
      font-size: 12px;
      line-height: 22px;
      color: var(--vscode-disabledForeground, rgba(204,204,204,0.5));
      font-style: italic;
    }

    /* ---- Nested tree groups (sub-accordion) ---- */
    .tree-group {
      list-style: none;
    }

    .tree-group-header {
      display: flex;
      align-items: center;
      height: 22px;
      padding: 0 12px 0 24px;
      cursor: pointer;
      font-family: var(--vscode-font-family, monospace);
      font-size: 13px;
      line-height: 22px;
      color: var(--vscode-foreground);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      user-select: none;
    }

    .tree-group-header:hover {
      background: var(--vscode-list-hoverBackground, rgba(255,255,255,0.04));
    }

    .tree-group-header:focus-visible {
      outline: 1px solid var(--vscode-focusBorder);
      outline-offset: -1px;
    }

    .tree-group-chevron {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      margin-right: 2px;
      flex-shrink: 0;
      transition: transform 0.1s ease;
    }

    .tree-group-chevron::before {
      content: '';
      display: block;
      width: 0;
      height: 0;
      border-left: 4px solid var(--vscode-foreground);
      border-top: 3px solid transparent;
      border-bottom: 3px solid transparent;
      opacity: 0.6;
    }

    .tree-group.is-open > .tree-group-header .tree-group-chevron {
      transform: rotate(90deg);
    }

    .tree-sub-list {
      display: none;
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .tree-group.is-open > .tree-sub-list {
      display: block;
    }

    .tree-sub-item {
      padding-left: 44px;
      font-size: 12px;
      color: var(--vscode-descriptionForeground, rgba(204,204,204,0.7));
    }

    .tree-sub-empty {
      font-style: italic;
    }

    /* ---- Resize handle ---- */
    .resize-handle {
      height: 4px;
      cursor: row-resize;
      flex-shrink: 0;
      position: relative;
      z-index: 1;
      margin: -2px 0;
    }

    .resize-handle:hover,
    .resize-handle.is-dragging {
      background: var(--vscode-sash-hoverBorder, var(--vscode-focusBorder));
    }

    /* ---- Docs section ---- */
    .treeview.docs-section {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }

    .treeview.docs-section.is-open > .treeview-body {
      display: flex;
      flex: 1;
      min-height: 0;
    }

    .treeview.docs-section > .treeview-body {
      flex: 1;
      overflow: hidden;
    }

    iframe {
      border: 0;
      width: 100%;
      height: 100%;
      display: block;
    }
`;
