import * as vscode from 'vscode';
import type { ComponentTagFileContext } from '../core/types';
import { getTagContext } from '../editor/getTagContext';
import { toKebabCase } from '../parsing/caseUtils';

const isPropsAlreadyPresent = (openTagText: string, attrName: string): boolean => {
  const regex = new RegExp(`\\s(?::?${attrName}|v-bind:${attrName})\\s*=`);
  return regex.test(openTagText);
};

function findPropValueRange(openTagText: string, attrName: string): { start: number; end: number } | undefined {
  const regex = new RegExp(`\\s(?::?${attrName}|v-bind:${attrName})\\s*=\\s*(["'])`);
  const match = regex.exec(openTagText);
  if (!match) return undefined;
  const quote = match[1];
  const start = match.index + match[0].length;
  const end = openTagText.indexOf(quote, start);
  if (end === -1) return undefined;
  return { start, end };
}

function findLastVModelEnd(openTagText: string): number | undefined {
  const regex = /\bv-model(?::[a-zA-Z0-9-]+)?(?:\.[a-zA-Z0-9-]+)*\s*=\s*(["'])/g;
  let lastEnd: number | undefined;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(openTagText)) !== null) {
    const quote = match[1];
    const valueStart = match.index + match[0].length;
    const valueEnd = openTagText.indexOf(quote, valueStart);
    if (valueEnd === -1) break;
    lastEnd = valueEnd + 1;
  }
  return lastEnd;
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
  const editor = await vscode.window.showTextDocument(document);

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
    const start = document.positionAt(tagOffset + range.start);
    const end = document.positionAt(tagOffset + range.end);
    const snippet = new vscode.SnippetString();
    snippet.appendText(value);
    snippet.appendTabstop(0);
    await editor.insertSnippet(snippet, new vscode.Range(start, end));
    return;
  }

  const lastVModelEnd = findLastVModelEnd(openTagText);
  const insertPos = lastVModelEnd !== undefined ? tagOffset + lastVModelEnd : tagOffset + 1 + tagName.length;
  const charAfter = insertPos < text.length ? text[insertPos] : '';
  const trailingSpace = charAfter === '/' ? ' ' : '';

  const snippet = new vscode.SnippetString();
  if (value) {
    snippet.appendText(` ${attrName}="`);
    snippet.appendText(value);
    snippet.appendTabstop(0);
    snippet.appendText(`"${trailingSpace}`);
  } else {
    snippet.appendText(` :${attrName}="`);
    snippet.appendTabstop(0);
    snippet.appendText(`"${trailingSpace}`);
  }
  await editor.insertSnippet(snippet, document.positionAt(insertPos));
}
