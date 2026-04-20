import { toKebabCase } from '../../parsing/caseUtils';
import { vModelKey } from '../../parsing/parseAttributes';
import type { VModelInfo } from '../../core/types';
import { escapeAttr, escapeHtml } from './escape';

const SECTION_ID = 'vmodels-accordion';

export function renderVModelsSection(vModels: VModelInfo[], tagName: string, usedVModelKeys: Set<string>): string {
  const body =
    vModels.length > 0
      ? `<ul class="tree-list">${vModels.map((v) => renderGroup(v, usedVModelKeys)).join('\n')}</ul>`
      : `<div class="tree-empty">${escapeHtml(`No v-models found for ${tagName}`)}</div>`;

  return /* html */ `
    <div class="treeview is-open" id="${SECTION_ID}">
      <div class="treeview-header" role="button" tabindex="0" data-target="${SECTION_ID}">
        <span class="treeview-chevron"></span>
        V-models -<span class="treeview-count">${vModels.length} item${vModels.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="treeview-body" role="tree">
        ${body}
      </div>
      <div class="resize-handle" data-resize="${SECTION_ID}"></div>
    </div>`;
}

function renderGroup({ name }: VModelInfo, usedVModelKeys: Set<string>): string {
  const kebab = toKebabCase(name);
  const isDefault = name.toLowerCase() === 'modelvalue';
  const groupLabel = isDefault ? 'v-model' : `v-model:${kebab}`;
  const vmodelLabel = isDefault ? 'v-model' : `v-model:${kebab}`;
  const propLabel = `:${kebab}`;
  const eventLabel = `@update:${kebab}`;
  const eventName = `update:${name}`;
  const subId = `${SECTION_ID}-${escapeAttr(kebab)}`;
  const key = vModelKey(name);
  const isUsed = usedVModelKeys.has(key);
  const usedClass = isUsed ? ' is-used' : '';
  const removeBtn = `<button class="tree-item-remove" data-remove-kind="vmodel" data-remove-key="${escapeAttr(key)}" title="Remove v-model" aria-label="Remove v-model" tabindex="-1">×</button>`;

  return `<li class="tree-group" role="treeitem">
    <div class="tree-group-header${usedClass}" role="button" tabindex="0" data-subtree="${subId}" data-vmodel="${escapeAttr(name)}">
      <span class="tree-group-chevron"></span>
      ${escapeHtml(groupLabel)}
      ${removeBtn}
    </div>
    <ul class="tree-sub-list" id="${subId}">
      <li class="tree-item tree-sub-item" role="treeitem" tabindex="0" data-vmodel="${escapeAttr(name)}">${escapeHtml(vmodelLabel)}</li>
      <li class="tree-item tree-sub-item" role="treeitem" tabindex="0" data-prop="${escapeAttr(name)}">${escapeHtml(propLabel)}</li>
      <li class="tree-item tree-sub-item" role="treeitem" tabindex="0" data-event="${escapeAttr(eventName)}">${escapeHtml(eventLabel)}</li>
    </ul>
  </li>`;
}
