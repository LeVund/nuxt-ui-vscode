import * as vscode from 'vscode';
import type { ComponentContext } from '../webview/panel';
import type { ParsedTag } from '../core/types';

export type { ParsedTag };
export { getParsedTag } from '../parsing/parseTag';
export { findMatchingClose } from '../parsing/findMatchingClose';

export function getLineIndentation(document: vscode.TextDocument, line: number): string {
  return document.lineAt(line).text.match(/^(\s*)/)?.[1] ?? '';
}

// =============================================================================
// Insertion commands
// =============================================================================

import { getParsedTag } from '../parsing/parseTag';

export async function getTagContext({
  documentUri,
  tagOffset,
  tagName,
}: ComponentContext): Promise<{ document: vscode.TextDocument; text: string; tag: ParsedTag } | undefined> {
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
