import * as vscode from 'vscode';
import type { ComponentContext } from '../core/types';
import { getTagContext } from '../editor/getTagContext';
import { toKebabCase } from '../parsing/caseUtils';

export async function insertProp({ tagOffset, tagName, ...ctx }: ComponentContext, propName: string): Promise<void> {
  const parsed = await getTagContext({ tagOffset, tagName, ...ctx });
  if (!parsed) return;
  const { document, text, tag } = parsed;

  const attrName = toKebabCase(propName);
  const openTagText = text.slice(tagOffset, tag.closeCharIdx + (tag.selfClosing ? 2 : 1));

  if (new RegExp(`\\b:?${attrName}\\s*=|v-bind:${attrName}\\s*=`).test(openTagText)) {
    void vscode.window.showInformationMessage(`Prop "${attrName}" is already set on <${tagName}>.`);
    return;
  }

  const charBefore = tag.closeCharIdx > 0 ? text[tag.closeCharIdx - 1] : '';
  const prefix = charBefore === ' ' || charBefore === '\t' ? '' : ' ';

  const edit = new vscode.WorkspaceEdit();
  edit.insert(document.uri, document.positionAt(tag.closeCharIdx), `${prefix}:${attrName}=""`);
  await vscode.workspace.applyEdit(edit);
}
