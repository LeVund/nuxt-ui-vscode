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
      ? `<ul class="tree-list">${values
          .map(
            (v) =>
              `<li class="tree-item" role="treeitem" tabindex="0" ${items[0].dataAttr}="${escapeAttr(v)}">${escapeHtml(items[0].label(v))}</li>`,
          )
          .join('\n')}</ul>`
      : `<div class="tree-empty">${escapeHtml(emptyLabel)}</div>`;

  return /* html */ `
    <div class="treeview is-open" id="${id}">
      <div class="treeview-header" role="button" tabindex="0" data-target="${id}">
        <span class="treeview-chevron"></span>
        ${escapeHtml(title)}<span class="treeview-count">${values.length} item${values.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="treeview-body" role="tree">
        ${body}
      </div>
    </div>`;
}
