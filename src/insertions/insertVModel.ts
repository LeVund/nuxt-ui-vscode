import * as vscode from 'vscode';
import type { ComponentTagFileContext } from '../core/types';
import { getTagContext } from '../editor/getTagContext';
import { toKebabCase } from '../parsing/caseUtils';

const isModelValue = (propName: string): boolean => propName.toLowerCase() === 'modelvalue';

const isVModelAlreadyPresent = (openTagText: string, directive: string): boolean => {
  const escaped = directive.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\s*=`).test(openTagText);
};

export async function insertVModel({ tagOffset, tagName, ...ctx }: ComponentTagFileContext, propName: string): Promise<void> {
  const parsed = await getTagContext({ tagOffset, tagName, ...ctx });
  if (!parsed) return;
  const { document, text, tag } = parsed;

  const directive = isModelValue(propName) ? 'v-model' : `v-model:${toKebabCase(propName)}`;
  const openTagText = text.slice(tagOffset, tag.closeCharIdx + (tag.selfClosing ? 2 : 1));

  if (isVModelAlreadyPresent(openTagText, directive)) {
    void vscode.window.showInformationMessage(`Directive "${directive}" is already set on <${tagName}>.`);
    return;
  }

  const charBefore = tag.closeCharIdx > 0 ? text[tag.closeCharIdx - 1] : '';
  const spacing = charBefore === ' ' || charBefore === '\t' ? '' : ' ';

  const editor = await vscode.window.showTextDocument(document);
  const snippet = new vscode.SnippetString();
  snippet.appendText(`${spacing}${directive}="`);
  snippet.appendTabstop(0);
  snippet.appendText('"');

  await editor.insertSnippet(snippet, document.positionAt(tag.closeCharIdx));
}
