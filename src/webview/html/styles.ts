export const STYLES = `
    *, *::before, *::after { box-sizing: border-box; }

    html, body {
      margin: 0;
      padding: 0;
      height: 100%;
      overflow: hidden;
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
    }

    .layout {
      display: flex;
      flex-direction: column;
      height: 100vh;
    }

    /* ---- Accordion shared ---- */
    .accordion {
      border-bottom: 1px solid var(--vscode-panel-border, #333);
      flex-shrink: 0;
    }

    .accordion-header {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      cursor: pointer;
      user-select: none;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--vscode-sideBarSectionHeader-foreground, var(--vscode-editor-foreground));
      background: var(--vscode-sideBarSectionHeader-background, transparent);
    }

    .accordion-header:hover {
      background: var(--vscode-list-hoverBackground);
    }

    .chevron {
      font-size: 9px;
      transition: transform 0.15s;
      display: inline-block;
      opacity: 0.7;
    }

    .accordion.is-open .chevron {
      transform: rotate(90deg);
    }

    .accordion-body {
      display: none;
    }

    .accordion.is-open .accordion-body {
      display: block;
    }

    /* ---- Slots section ---- */
    .slots-body {
      padding: 8px 12px 10px;
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
    }

    .slot-btn {
      background: var(--vscode-button-secondaryBackground, #3c3c3c);
      color: var(--vscode-button-secondaryForeground, #ccc);
      border: 1px solid transparent;
      padding: 3px 10px;
      border-radius: 3px;
      cursor: pointer;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 12px;
      line-height: 1.6;
      transition: background 0.1s;
    }

    .slot-btn:hover {
      background: var(--vscode-button-secondaryHoverBackground, #505050);
      border-color: var(--vscode-focusBorder, #007fd4);
    }

    .slots-empty {
      font-size: 12px;
      opacity: 0.5;
      font-style: italic;
    }

    /* ---- Docs section ---- */
    .accordion.docs-accordion {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }

    .accordion.docs-accordion.is-open .accordion-body {
      display: flex;
      flex: 1;
      min-height: 0;
    }

    .docs-body {
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
