import { toKebabCase } from '../../parsing/caseUtils';
import type { VModelInfo } from '../../core/types';
import { escapeAttr, escapeHtml } from './escape';

const SECTION_ID = 'vmodels-accordion';

export function renderVModelsSection(vModels: VModelInfo[], tagName: string): string {
  const body =
    vModels.length > 0
      ? `<ul class="tree-list">${vModels.map(renderGroup).join('\n')}</ul>`
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

function renderGroup({ name }: VModelInfo): string {
  const kebab = toKebabCase(name);
  const isDefault = name.toLowerCase() === 'modelvalue';
  const groupLabel = isDefault ? 'v-model' : `v-model:${kebab}`;
  const vmodelLabel = isDefault ? 'v-model' : `v-model:${kebab}`;
  const propLabel = `:${kebab}`;
  const eventLabel = `@update:${kebab}`;
  const eventName = `update:${name}`;
  const subId = `${SECTION_ID}-${escapeAttr(kebab)}`;

  return `<li class="tree-group" role="treeitem">
    <div class="tree-group-header" role="button" tabindex="0" data-subtree="${subId}" data-vmodel="${escapeAttr(name)}">
      <span class="tree-group-chevron"></span>
      ${escapeHtml(groupLabel)}
    </div>
    <ul class="tree-sub-list" id="${subId}">
      <li class="tree-item tree-sub-item" role="treeitem" tabindex="0" data-vmodel="${escapeAttr(name)}">${escapeHtml(vmodelLabel)}</li>
      <li class="tree-item tree-sub-item" role="treeitem" tabindex="0" data-prop="${escapeAttr(name)}">${escapeHtml(propLabel)}</li>
      <li class="tree-item tree-sub-item" role="treeitem" tabindex="0" data-event="${escapeAttr(eventName)}">${escapeHtml(eventLabel)}</li>
    </ul>
  </li>`;
}
