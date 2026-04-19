import { STYLES } from './styles';

const PLACEHOLDER_STYLES = `
    .placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      padding: 24px;
      text-align: center;
      color: var(--vscode-disabledForeground, rgba(204,204,204,0.5));
    }

    .placeholder-icon {
      font-size: 48px;
      margin-bottom: 16px;
      opacity: 0.4;
    }

    .placeholder-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--vscode-foreground);
      margin-bottom: 8px;
    }

    .placeholder-text {
      font-size: 12px;
      line-height: 1.5;
      max-width: 260px;
    }

    .placeholder-hint {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-top: 12px;
      padding: 4px 8px;
      font-size: 11px;
      border-radius: 3px;
      background: var(--vscode-textCodeBlock-background, rgba(255,255,255,0.06));
      color: var(--vscode-textPreformat-foreground, var(--vscode-foreground));
      font-family: var(--vscode-editor-font-family, monospace);
    }
`;

export function renderPlaceholder(): string {
  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'" />
  <title>Nuxt UI Docs</title>
  <style>${STYLES}${PLACEHOLDER_STYLES}</style>
</head>
<body>
  <div class="placeholder">
    <div class="placeholder-icon">☰</div>
    <div class="placeholder-title">No component selected</div>
    <div class="placeholder-text">
      Click on a <strong>CodeLens</strong> action above a Nuxt UI component in your template to view its documentation here.
    </div>
    <div class="placeholder-hint">Nuxt UI Docs</div>
  </div>
</body>
</html>`;
}
