import * as vscode from 'vscode';
import type { ComponentContext } from '../core/types';
import { getTagContext } from '../editor/getTagContext';

export async function insertUiKey({ tagOffset, tagName, ...ctx }: ComponentContext, keyName: string): Promise<void> {
  const parsed = await getTagContext({ tagOffset, tagName, ...ctx });
  if (!parsed) return;
  const { document, text, tag } = parsed;

  const tagText = text.slice(tagOffset, tag.closeCharIdx);
  const uiAttrMatch = /(?::ui|v-bind:ui)\s*=\s*(["'])/.exec(tagText);

  if (!uiAttrMatch) {
    const charBefore = tag.closeCharIdx > 0 ? text[tag.closeCharIdx - 1] : '';
    const prefix = charBefore === ' ' || charBefore === '\t' ? '' : ' ';
    const edit = new vscode.WorkspaceEdit();
    edit.insert(document.uri, document.positionAt(tag.closeCharIdx), `${prefix}:ui="{ ${keyName}: '' }"`);
    await vscode.workspace.applyEdit(edit);
    return;
  }

  const quoteChar = uiAttrMatch[1];
  const attrValueStart = tagOffset + uiAttrMatch.index + uiAttrMatch[0].length;

  let closingQuotePos = -1;
  for (let j = attrValueStart; j < text.length; j++) {
    if (text[j] === quoteChar) {
      closingQuotePos = j;
      break;
    }
  }

  if (closingQuotePos === -1) {
    void vscode.window.showWarningMessage(`Could not parse the :ui attribute value of <${tagName}>.`);
    return;
  }

  const attrValue = text.slice(attrValueStart, closingQuotePos);

  if (new RegExp(`\\b${keyName}\\s*:`).test(attrValue)) {
    void vscode.window.showInformationMessage(`UI key "${keyName}" is already set on <${tagName}>.`);
    return;
  }

  const lastBrace = attrValue.lastIndexOf('}');
  if (lastBrace === -1) {
    void vscode.window.showWarningMessage(`Could not locate the :ui object for <${tagName}>.`);
    return;
  }

  const innerContent = attrValue
    .slice(0, lastBrace)
    .replace(/^\s*\{/, '')
    .trim();
  const insertion = innerContent.length > 0 ? `, ${keyName}: ''` : `${keyName}: ''`;

  const edit = new vscode.WorkspaceEdit();
  edit.insert(document.uri, document.positionAt(attrValueStart + lastBrace), insertion);
  await vscode.workspace.applyEdit(edit);
}
