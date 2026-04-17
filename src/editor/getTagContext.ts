import * as vscode from 'vscode';
import type { ComponentTagFileContext, ParsedTag } from '../core/types';
import { getParsedTag } from '../parsing/getParseTag';

export async function getTagContext({
  documentUri,
  tagOffset,
  tagName,
}: ComponentTagFileContext): Promise<{ document: vscode.TextDocument; text: string; tag: ParsedTag } | undefined> {
  let document: vscode.TextDocument;

  try {
    document = await vscode.workspace.openTextDocument(documentUri);
  } catch {
    void vscode.window.showErrorMessage('Could not open the source file.');
    return undefined;
  }

  const text = document.getText();
  const tag = getParsedTag(text, tagOffset, tagName);

  if (!tag) {
    void vscode.window.showWarningMessage(`Could not parse the opening tag of <${tagName}>.`);
    return undefined;
  }

  return { document, text, tag };
}
