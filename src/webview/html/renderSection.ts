import { normalizeKey } from '../../parsing/parseAttributes';
import { escapeAttr, escapeHtml } from './escape';

export interface TreeItem {
  name: string;
  children?: string[];
  isVModel?: boolean;
}

export interface UsedConfig {
  /** Which remove command to send when the cross is clicked. */
  removeKind: 'prop' | 'event';
  /** Normalized keys already present on the component tag. */
  usedKeys: Set<string>;
}

const V_BADGE = '<span class="tree-item-badge">V</span>';
const REMOVE_BUTTON = (kind: string, key: string) =>
  `<button class="tree-item-remove" data-remove-kind="${kind}" data-remove-key="${escapeAttr(key)}" title="Remove attribute" aria-label="Remove attribute" tabindex="-1">×</button>`;

export function renderSection(
  id: string,
  title: string,
  items: { className: string; dataAttr: string; label: (item: string) => string }[],
  values: TreeItem[],
  emptyLabel: string,
  used?: UsedConfig,
): string {
  const body =
    values.length > 0
      ? `<ul class="tree-list">${values
          .map((v) => {
            const badge = v.isVModel ? V_BADGE : '';
            const key = normalizeKey(v.name);
            const isUsed = used?.usedKeys.has(key) ?? false;
            const usedClass = isUsed ? ' is-used' : '';
            const removeBtn = used ? REMOVE_BUTTON(used.removeKind, key) : '';

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
                <div class="tree-group-header${usedClass}" role="button" tabindex="0" data-subtree="${subId}" ${items[0].dataAttr}="${escapeAttr(v.name)}">
                  <span class="tree-group-chevron"></span>
                  ${escapeHtml(items[0].label(v.name))}${badge}
                  ${removeBtn}
                </div>
                <ul class="tree-sub-list" id="${subId}">${subItems}</ul>
              </li>`;
            }
            return `<li class="tree-item${usedClass}" role="treeitem" tabindex="0" ${items[0].dataAttr}="${escapeAttr(v.name)}">${escapeHtml(items[0].label(v.name))}${badge}${removeBtn}</li>`;
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
