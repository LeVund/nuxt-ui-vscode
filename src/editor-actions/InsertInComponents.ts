import * as vscode from 'vscode';
import { ComponentContext } from '../webview/panel';
import { findMatchingClose, getLineIndentation, getTagContext } from '../utils/tagUtils';
import { toKebabCase } from '../utils/syntaxUtils';

export async function insertSlot({ tagOffset, tagName, ...ctx }: ComponentContext, slotName: string): Promise<void> {
  const parsed = await getTagContext({ tagOffset, tagName, ...ctx });
  if (!parsed) return;

  const { document, text, tag } = parsed;

  const edit = new vscode.WorkspaceEdit();
  const tagLine = document.positionAt(tagOffset).line;
  const indentation = getLineIndentation(document, tagLine);
  const slotIndent = indentation + '  ';

  if (tag.selfClosing) {
    const slashGtPos = document.positionAt(tag.openTagEnd - 2);
    const afterGtPos = document.positionAt(tag.openTagEnd);
    const replacement = `>\n${slotIndent}<template #${slotName}>\n${slotIndent}</template>\n${indentation}</${tagName}>`;
    edit.replace(document.uri, new vscode.Range(slashGtPos, afterGtPos), replacement);
  } else {
    const closingIdx = findMatchingClose(text, tagName, tag.openTagEnd);
    if (closingIdx === -1) {
      void vscode.window.showWarningMessage(`Could not find the closing </${tagName}> tag.`);
      return;
    }

    const innerContent = text.slice(tag.openTagEnd, closingIdx);
    if (new RegExp(`#${slotName}\\b`).test(innerContent)) {
      void vscode.window.showInformationMessage(`Slot #${slotName} is already used in <${tagName}>.`);
      return;
    }

    const insertPos = document.positionAt(closingIdx);
    const insertion = `${slotIndent}<template #${slotName}>\n${slotIndent}</template>\n${indentation}`;
    edit.insert(document.uri, insertPos, insertion);
  }

  await vscode.workspace.applyEdit(edit);
}

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
