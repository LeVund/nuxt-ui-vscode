import { toKebabCase } from '../utils/syntaxUtils';

export function homePath(version: 'v3' | 'v4'): string {
  return version === 'v4' ? '/docs/getting-started' : '/getting-started';
}

export function componentPath(version: 'v3' | 'v4', slug: string): string {
  return version === 'v4' ? `/docs/components/${slug}` : `/components/${slug}`;
}

export function extractPath(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return '/';
  }
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderSection(
  id: string,
  title: string,
  items: { className: string; dataAttr: string; label: (item: string) => string }[],
  values: string[],
  emptyLabel: string,
): string {
  const body =
    values.length > 0
      ? values
          .map(
            (v) =>
              `<button class="${items[0].className} slot-btn" ${items[0].dataAttr}="${escapeAttr(v)}">${escapeHtml(items[0].label(v))}</button>`,
          )
          .join('\n        ')
      : `<span class="slots-empty">${escapeHtml(emptyLabel)}</span>`;

  return /* html */ `
    <div class="accordion is-open" id="${id}">
      <div class="accordion-header" data-target="${id}">
        <span class="chevron">▶</span>
        ${escapeHtml(title)}
      </div>
      <div class="accordion-body slots-body">
        ${body}
      </div>
    </div>`;
}

export function renderHtml(url: string, tagName: string | undefined, slots: string[], props: string[], uiKeys: string[]): string {
  const origin = new URL(url).origin;
  const csp = ["default-src 'none'", `frame-src ${origin}`, "style-src 'unsafe-inline'", "script-src 'unsafe-inline'"].join('; ');

  const propsSection = tagName
    ? renderSection(
        'props-accordion',
        `Props — ${tagName}`,
        [{ className: 'prop-btn', dataAttr: 'data-prop', label: (p) => `:${toKebabCase(p)}` }],
        props,
        `No props found for ${tagName}`,
      )
    : '';
  const uiSection = tagName
    ? renderSection(
        'ui-accordion',
        `UI — ${tagName}`,
        [{ className: 'ui-key-btn', dataAttr: 'data-ui-key', label: (k) => k }],
        uiKeys,
        `No ui keys found for ${tagName}`,
      )
    : '';
  const slotsSection = tagName
    ? renderSection(
        'slots-accordion',
        `Slots — ${tagName}`,
        [{ className: 'slot-btn', dataAttr: 'data-slot', label: (s) => `#${s}` }],
        slots,
        `No slots found for ${tagName}`,
      )
    : '';

  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <title>Nuxt UI Docs</title>
  <style>
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
  </style>
</head>
<body>
  <div class="layout">
    ${propsSection}
    ${uiSection}
    ${slotsSection}
    <div class="accordion docs-accordion is-open" id="docs-accordion">
      <div class="accordion-header" data-target="docs-accordion">
        <span class="chevron">▶</span>
        Documentation
      </div>
      <div class="accordion-body docs-body">
        <iframe src="${escapeAttr(url)}" allow="clipboard-read; clipboard-write"></iframe>
      </div>
    </div>
  </div>
  <script>
    // Accordion toggle
    document.querySelectorAll('.accordion-header').forEach(function(header) {
      header.addEventListener('click', function() {
        var targetId = header.dataset.target;
        var accordion = document.getElementById(targetId);
        if (accordion) {
          accordion.classList.toggle('is-open');
        }
      });
    });

    // Slot insertion
    var vscode = acquireVsCodeApi();
    document.querySelectorAll('[data-slot]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        vscode.postMessage({ command: 'insertSlot', slotName: btn.dataset.slot });
      });
    });

    // Prop insertion
    document.querySelectorAll('[data-prop]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        vscode.postMessage({ command: 'insertProp', propName: btn.dataset.prop });
      });
    });

    // UI key insertion
    document.querySelectorAll('[data-ui-key]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        vscode.postMessage({ command: 'insertUiKey', keyName: btn.dataset.uiKey });
      });
    });
  </script>
</body>
</html>`;
}
