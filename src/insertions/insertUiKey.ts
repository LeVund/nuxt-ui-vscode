import * as vscode from 'vscode';
import type { ComponentTagFileContext } from '../core/types';
import { getTagContext } from '../editor/getTagContext';

function findUiAttribute(text: string, tagOffset: number, closeCharIdx: number): RegExpExecArray | null {
  const tagText = text.slice(tagOffset, closeCharIdx);
  return /(?::ui|v-bind:ui)\s*=\s*(["'])/.exec(tagText);
}

function parseUiObject(
  text: string,
  attrValueStart: number,
  quoteChar: string,
): { attrValue: string; closingQuotePos: number } | undefined {
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

function buildNewUiAttributeSnippet(text: string, closeCharIdx: number, keyName: string): vscode.SnippetString {
  const charBefore = closeCharIdx > 0 ? text[closeCharIdx - 1] : '';
  const prefix = charBefore === ' ' || charBefore === '\t' ? '' : ' ';
  const snippet = new vscode.SnippetString();
  snippet.appendText(`${prefix}:ui="{ ${keyName}: '`);
  snippet.appendTabstop(0);
  snippet.appendText(`' }"`);
  return snippet;
}

function buildAppendKeySnippet(attrValue: string, keyName: string): vscode.SnippetString | undefined {
  const lastBrace = attrValue.lastIndexOf('}');
  if (lastBrace === -1) return undefined;

  const innerContent = attrValue
    .slice(0, lastBrace)
    .replace(/^\s*\{/, '')
    .trim();
  const separator = innerContent.length > 0 ? ', ' : '';

  const snippet = new vscode.SnippetString();
  snippet.appendText(`${separator}${keyName}: '`);
  snippet.appendTabstop(0);
  snippet.appendText(`'`);
  return snippet;
}

export async function insertUiKey({ tagOffset, tagName, ...ctx }: ComponentTagFileContext, keyName: string): Promise<void> {
  const parsed = await getTagContext({ tagOffset, tagName, ...ctx });
  if (!parsed) return;
  const { document, text, tag } = parsed;

  const editor = await vscode.window.showTextDocument(document);
  const uiAttrMatch = findUiAttribute(text, tagOffset, tag.closeCharIdx);

  if (!uiAttrMatch) {
    const snippet = buildNewUiAttributeSnippet(text, tag.closeCharIdx, keyName);
    await editor.insertSnippet(snippet, document.positionAt(tag.closeCharIdx));
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

  const lastBrace = attrValue.lastIndexOf('}');
  if (lastBrace === -1) {
    void vscode.window.showWarningMessage(`Could not locate the :ui object for <${tagName}>.`);
    return;
  }

  const snippet = buildAppendKeySnippet(attrValue, keyName);
  if (!snippet) {
    void vscode.window.showWarningMessage(`Could not locate the :ui object for <${tagName}>.`);
    return;
  }

  await editor.insertSnippet(snippet, document.positionAt(attrValueStart + lastBrace));
}
