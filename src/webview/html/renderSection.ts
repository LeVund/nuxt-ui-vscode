import { escapeAttr, escapeHtml } from './escape';

export function renderSection(
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
