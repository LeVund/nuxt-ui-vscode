import * as vscode from 'vscode';
import type { ComponentContext } from '../webview/panel';

// =============================================================================
// Tag parsing helpers
// =============================================================================

export interface ParsedTag {
  /** Index right after the closing `>` or `/>` */
  openTagEnd: number;
  /** Whether the tag is self-closing (`/>`) */
  selfClosing: boolean;
  /** Index of the `>` (or `/` for `/>`) */
  closeCharIdx: number;
}

export function getParsedTag(text: string, tagStart: number, tagName: string): ParsedTag | undefined {
  let i = tagStart + 1 + tagName.length;
  let inString: string | null = null;

  while (i < text.length) {
    const ch = text[i];
    if (inString) {
      if (ch === inString) inString = null;
    } else if (ch === '"' || ch === "'") {
      inString = ch;
    } else if (ch === '/' && i + 1 < text.length && text[i + 1] === '>') {
      return { openTagEnd: i + 2, selfClosing: true, closeCharIdx: i };
    } else if (ch === '>') {
      return { openTagEnd: i + 1, selfClosing: false, closeCharIdx: i };
    }
    i++;
  }
  return undefined;
}

export function findMatchingClose(text: string, tagName: string, fromIndex: number): number {
  const openRe = new RegExp(`<${tagName}\\b`, 'g');
  const closeRe = new RegExp(`<\\/${tagName}>`, 'g');

  openRe.lastIndex = fromIndex;
  closeRe.lastIndex = fromIndex;

  let depth = 0;
  let nextOpen = openRe.exec(text);
  let nextClose = closeRe.exec(text);

  while (nextClose !== null) {
    const openIdx = nextOpen ? nextOpen.index : Infinity;
    const closeIdx = nextClose.index;

    if (openIdx < closeIdx) {
      depth++;
      nextOpen = openRe.exec(text);
    } else {
      if (depth === 0) return closeIdx;
      depth--;
      nextClose = closeRe.exec(text);
    }
  }

  return -1;
}

export function getLineIndentation(document: vscode.TextDocument, line: number): string {
  return document.lineAt(line).text.match(/^(\s*)/)?.[1] ?? '';
}

// =============================================================================
// Insertion commands
// =============================================================================

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
