import * as vscode from 'vscode';
import type { ComponentContext } from '../core/types';
import { getTagContext } from '../editor/getTagContext';

function findUiAttribute(text: string, tagOffset: number, closeCharIdx: number): RegExpExecArray | null {
  const tagText = text.slice(tagOffset, closeCharIdx);
  return /(?::ui|v-bind:ui)\s*=\s*(["'])/.exec(tagText);
}

function parseUiObject(text: string, attrValueStart: number, quoteChar: string): { attrValue: string; closingQuotePos: number } | undefined {
  let closingQuotePos = -1;
  for (let j = attrValueStart; j < text.length; j++) {
    if (text[j] === quoteChar) {
      closingQuotePos = j;
      break;
    }
  }
  if (closingQuotePos === -1) return undefined;
  return { attrValue: text.slice(attrValueStart, closingQuotePos), closingQuotePos };
}

function buildNewUiAttributeEdit(
  document: vscode.TextDocument,
  text: string,
  closeCharIdx: number,
  keyName: string,
): vscode.WorkspaceEdit {
  const charBefore = closeCharIdx > 0 ? text[closeCharIdx - 1] : '';
  const prefix = charBefore === ' ' || charBefore === '\t' ? '' : ' ';
  const edit = new vscode.WorkspaceEdit();
  edit.insert(document.uri, document.positionAt(closeCharIdx), `${prefix}:ui="{ ${keyName}: '' }"`);
  return edit;
}

function buildAppendKeyEdit(
  document: vscode.TextDocument,
  attrValueStart: number,
  attrValue: string,
  keyName: string,
): vscode.WorkspaceEdit | undefined {
  const lastBrace = attrValue.lastIndexOf('}');
  if (lastBrace === -1) return undefined;

  const innerContent = attrValue
    .slice(0, lastBrace)
    .replace(/^\s*\{/, '')
    .trim();
  const insertion = innerContent.length > 0 ? `, ${keyName}: ''` : `${keyName}: ''`;

  const edit = new vscode.WorkspaceEdit();
  edit.insert(document.uri, document.positionAt(attrValueStart + lastBrace), insertion);
  return edit;
}

export async function insertUiKey({ tagOffset, tagName, ...ctx }: ComponentContext, keyName: string): Promise<void> {
  const parsed = await getTagContext({ tagOffset, tagName, ...ctx });
  if (!parsed) return;
  const { document, text, tag } = parsed;

  const uiAttrMatch = findUiAttribute(text, tagOffset, tag.closeCharIdx);

  if (!uiAttrMatch) {
    const edit = buildNewUiAttributeEdit(document, text, tag.closeCharIdx, keyName);
    await vscode.workspace.applyEdit(edit);
    return;
  }

  const quoteChar = uiAttrMatch[1];
  const attrValueStart = tagOffset + uiAttrMatch.index + uiAttrMatch[0].length;

  const parsed2 = parseUiObject(text, attrValueStart, quoteChar);
  if (!parsed2) {
    void vscode.window.showWarningMessage(`Could not parse the :ui attribute value of <${tagName}>.`);
    return;
  }

  const { attrValue } = parsed2;

  if (new RegExp(`\\b${keyName}\\s*:`).test(attrValue)) {
    void vscode.window.showInformationMessage(`UI key "${keyName}" is already set on <${tagName}>.`);
    return;
  }

  const edit = buildAppendKeyEdit(document, attrValueStart, attrValue, keyName);
  if (!edit) {
    void vscode.window.showWarningMessage(`Could not locate the :ui object for <${tagName}>.`);
    return;
  }

  await vscode.workspace.applyEdit(edit);
}
