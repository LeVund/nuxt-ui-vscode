import * as vscode from 'vscode';

export function getLineIndentation(document: vscode.TextDocument, line: number): string {
  return document.lineAt(line).text.match(/^(\s*)/)?.[1] ?? '';
}
