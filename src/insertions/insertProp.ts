import * as vscode from 'vscode';
import type { ComponentTagFileContext } from '../core/types';
import { getTagContext } from '../editor/getTagContext';
import { toKebabCase } from '../parsing/caseUtils';

const isPropsAlreadyPresent = (openTagText: string, attrName: string): boolean => {
  const regex = new RegExp(`\\b:?${attrName}\\s*=|v-bind:${attrName}\\s*=`);
  return regex.test(openTagText);
};

export async function insertProp({ tagOffset, tagName, ...ctx }: ComponentTagFileContext, propName: string): Promise<void> {
  const parsed = await getTagContext({ tagOffset, tagName, ...ctx });
  if (!parsed) return;
  const { document, text, tag } = parsed;

  const attrName = toKebabCase(propName);
  const openTagText = text.slice(tagOffset, tag.closeCharIdx + (tag.selfClosing ? 2 : 1));

  if (isPropsAlreadyPresent(openTagText, attrName)) {
    void vscode.window.showInformationMessage(`Prop "${attrName}" is already set on <${tagName}>.`);
    return;
  }

  const charBefore = tag.closeCharIdx > 0 ? text[tag.closeCharIdx - 1] : '';
  const spacing = charBefore === ' ' || charBefore === '\t' ? '' : ' ';

  const edit = new vscode.WorkspaceEdit();
  edit.insert(document.uri, document.positionAt(tag.closeCharIdx), `${spacing}:${attrName}=""`);
  await vscode.workspace.applyEdit(edit);
}
