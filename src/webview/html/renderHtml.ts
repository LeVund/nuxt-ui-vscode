import { toKebabCase } from '../../parsing/caseUtils';
import { escapeAttr } from './escape';
import { STYLES } from './styles';
import { WEBVIEW_SCRIPT } from './webviewScript';
import { renderSection } from './renderSection';

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
  <style>${STYLES}</style>
</head>
<body>
  <div class="layout">
    ${propsSection}
    ${uiSection}
    ${slotsSection}
    <div class="treeview docs-section is-open" id="docs-section">
      <div class="treeview-header" role="button" tabindex="0" data-target="docs-section">
        <span class="treeview-chevron"></span>
        Documentation
      </div>
      <div class="treeview-body">
        <iframe src="${escapeAttr(url)}" allow="clipboard-read; clipboard-write"></iframe>
      </div>
    </div>
  </div>
  <script>${WEBVIEW_SCRIPT}</script>
</body>
</html>`;
}
