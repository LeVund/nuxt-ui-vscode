import { toKebabCase } from '../../parsing/caseUtils';
import type { UsedAttrs } from '../../parsing/parseAttributes';
import type { PropInfo, SlotInfo, VModelInfo } from '../../core/types';
import { escapeAttr } from './escape';
import { STYLES } from './styles';
import { WEBVIEW_SCRIPT } from './webviewScript';
import { renderSection } from './renderSection';
import type { TreeItem } from './renderSection';
import { renderVModelsSection } from './renderVModelsSection';

const EMPTY_USED: UsedAttrs = { props: new Set(), events: new Set(), vModels: new Set() };

export function renderHtml(
  url: string,
  tagName: string | undefined,
  slots: SlotInfo[],
  props: PropInfo[],
  events: string[],
  vModels: VModelInfo[],
  uiKeys: string[],
  used: UsedAttrs = EMPTY_USED,
): string {
  const origin = new URL(url).origin;
  const csp = ["default-src 'none'", `frame-src ${origin}`, "style-src 'unsafe-inline'", "script-src 'unsafe-inline'"].join('; ');

  const vModelPropNames = new Set(vModels.map((v) => v.name.toLowerCase()));
  const vModelEventNames = new Set(vModels.map((v) => `update:${v.name}`.toLowerCase()));

  const propItems: TreeItem[] = props
    .map((p) => ({ name: p.name, children: p.values, isVModel: vModelPropNames.has(p.name.toLowerCase()) }))
    .sort((a, b) => Number(b.isVModel) - Number(a.isVModel));
  const slotItems: TreeItem[] = slots.map((s) => ({ name: s.name, children: s.bindings }));
  const eventItems: TreeItem[] = events
    .map((e) => ({ name: e, isVModel: vModelEventNames.has(e.toLowerCase()) }))
    .sort((a, b) => Number(b.isVModel) - Number(a.isVModel));
  const uiItems: TreeItem[] = uiKeys.map((k) => ({ name: k }));

  const vModelsSection = tagName ? renderVModelsSection(vModels, tagName, used.vModels) : '';
  const propsSection = tagName
    ? renderSection(
        'props-accordion',
        `Props -`,
        [{ className: 'prop-btn', dataAttr: 'data-prop', label: (p) => `:${toKebabCase(p)}` }],
        propItems,
        `No props found for ${tagName}`,
        { removeKind: 'prop', usedKeys: used.props },
      )
    : '';
  const eventsSection = tagName
    ? renderSection(
        'events-accordion',
        `Events -`,
        [{ className: 'event-btn', dataAttr: 'data-event', label: (e) => `@${toKebabCase(e)}` }],
        eventItems,
        `No events found for ${tagName}`,
        { removeKind: 'event', usedKeys: used.events },
      )
    : '';
  const slotsSection = tagName
    ? renderSection(
        'slots-accordion',
        `Slots -`,
        [{ className: 'slot-btn', dataAttr: 'data-slot', label: (s) => `#${s}` }],
        slotItems,
        `No slots found for ${tagName}`,
      )
    : '';
  const uiSection = tagName
    ? renderSection(
        'ui-accordion',
        `UI -`,
        [{ className: 'ui-key-btn', dataAttr: 'data-ui-key', label: (k) => k }],
        uiItems,
        `No ui keys found for ${tagName}`,
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
    ${vModelsSection}
    ${propsSection}
    ${eventsSection}
    ${slotsSection}
    ${uiSection}
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
