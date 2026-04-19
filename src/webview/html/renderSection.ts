import { escapeAttr, escapeHtml } from './escape';

export interface TreeItem {
  name: string;
  children?: string[];
}

export function renderSection(
  id: string,
  title: string,
  items: { className: string; dataAttr: string; label: (item: string) => string }[],
  values: TreeItem[],
  emptyLabel: string,
): string {
  const body =
    values.length > 0
      ? `<ul class="tree-list">${values
          .map((v) => {
            if (v.children && v.children.length > 0) {
              const subId = `${id}-${escapeAttr(v.name)}`;
              const emptyItem = `<li class="tree-item tree-sub-item tree-sub-empty" role="treeitem" tabindex="0" ${items[0].dataAttr}="${escapeAttr(v.name)}">empty</li>`;
              const subItems = [
                emptyItem,
                ...v.children.map(
                  (c) =>
                    `<li class="tree-item tree-sub-item" role="treeitem" tabindex="0" ${items[0].dataAttr}="${escapeAttr(v.name)}" data-value="${escapeAttr(c)}">${escapeHtml(c)}</li>`,
                ),
              ].join('\n');
              return `<li class="tree-group" role="treeitem">
                <div class="tree-group-header" role="button" tabindex="0" data-subtree="${subId}" ${items[0].dataAttr}="${escapeAttr(v.name)}">
                  <span class="tree-group-chevron"></span>
                  ${escapeHtml(items[0].label(v.name))}
                </div>
                <ul class="tree-sub-list" id="${subId}">${subItems}</ul>
              </li>`;
            }
            return `<li class="tree-item" role="treeitem" tabindex="0" ${items[0].dataAttr}="${escapeAttr(v.name)}">${escapeHtml(items[0].label(v.name))}</li>`;
          })
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
      <div class="resize-handle" data-resize="${id}"></div>
    </div>`;
}
