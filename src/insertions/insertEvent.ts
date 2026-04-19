import * as vscode from 'vscode';
import type { ComponentTagFileContext } from '../core/types';
import { getTagContext } from '../editor/getTagContext';
import { toKebabCase } from '../parsing/caseUtils';

const isEventAlreadyPresent = (openTagText: string, eventName: string): boolean => {
  const regex = new RegExp(`\\b@${eventName}\\s*=|v-on:${eventName}\\s*=`);
  return regex.test(openTagText);
};

export async function insertEvent({ tagOffset, tagName, ...ctx }: ComponentTagFileContext, eventName: string): Promise<void> {
  const parsed = await getTagContext({ tagOffset, tagName, ...ctx });
  if (!parsed) return;
  const { document, text, tag } = parsed;

  const attrName = toKebabCase(eventName);
  const openTagText = text.slice(tagOffset, tag.closeCharIdx + (tag.selfClosing ? 2 : 1));

  if (isEventAlreadyPresent(openTagText, attrName)) {
    void vscode.window.showInformationMessage(`Event "@${attrName}" is already set on <${tagName}>.`);
    return;
  }

  const charBefore = tag.closeCharIdx > 0 ? text[tag.closeCharIdx - 1] : '';
  const spacing = charBefore === ' ' || charBefore === '\t' ? '' : ' ';

  const edit = new vscode.WorkspaceEdit();
  edit.insert(document.uri, document.positionAt(tag.closeCharIdx), `${spacing}@${attrName}="($event) => {}"`);
  await vscode.workspace.applyEdit(edit);
}
