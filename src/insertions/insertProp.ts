import * as vscode from 'vscode';
import type { ComponentTagFileContext } from '../core/types';
import { getTagContext } from '../editor/getTagContext';
import { toKebabCase } from '../parsing/caseUtils';

const isPropsAlreadyPresent = (openTagText: string, attrName: string): boolean => {
  const regex = new RegExp(`\\b:?${attrName}\\s*=|v-bind:${attrName}\\s*=`);
  return regex.test(openTagText);
};

function findPropValueRange(openTagText: string, attrName: string): { start: number; end: number } | undefined {
  const regex = new RegExp(`(?:\\b:?${attrName}|v-bind:${attrName})\\s*=\\s*(["'])`);
  const match = regex.exec(openTagText);
  if (!match) return undefined;
  const quote = match[1];
  const start = match.index + match[0].length;
  const end = openTagText.indexOf(quote, start);
  if (end === -1) return undefined;
  return { start, end };
}

export async function insertProp(
  { tagOffset, tagName, ...ctx }: ComponentTagFileContext,
  propName: string,
  value?: string,
): Promise<void> {
  const parsed = await getTagContext({ tagOffset, tagName, ...ctx });
  if (!parsed) return;
  const { document, text, tag } = parsed;

  const attrName = toKebabCase(propName);
  const openTagText = text.slice(tagOffset, tag.closeCharIdx + (tag.selfClosing ? 2 : 1));

  if (isPropsAlreadyPresent(openTagText, attrName)) {
    if (!value) {
      void vscode.window.showInformationMessage(`Prop "${attrName}" is already set on <${tagName}>.`);
      return;
    }
    const range = findPropValueRange(openTagText, attrName);
    if (!range) {
      void vscode.window.showWarningMessage(`Could not locate the "${attrName}" value on <${tagName}>.`);
      return;
    }
    const edit = new vscode.WorkspaceEdit();
    const start = document.positionAt(tagOffset + range.start);
    const end = document.positionAt(tagOffset + range.end);
    edit.replace(document.uri, new vscode.Range(start, end), value);
    await vscode.workspace.applyEdit(edit);
    return;
  }

  const charBefore = tag.closeCharIdx > 0 ? text[tag.closeCharIdx - 1] : '';
  const spacing = charBefore === ' ' || charBefore === '\t' ? '' : ' ';

  const insertion = value ? `${spacing}${attrName}="${value}"` : `${spacing}:${attrName}=""`;

  const edit = new vscode.WorkspaceEdit();
  edit.insert(document.uri, document.positionAt(tag.closeCharIdx), insertion);
  await vscode.workspace.applyEdit(edit);
}
