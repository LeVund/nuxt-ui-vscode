import * as vscode from 'vscode';
import { isNuxtUiTag } from '../core/components';
import type { ComponentMatch } from '../core/types';

/**
 * Scans a document for Nuxt UI component opening tags.
 *
 * Notes:
 *  - Only opening tags are matched (`<UButton`, `<UButton />`, etc.).
 *  - Closing tags and non-Nuxt UI tags are ignored.
 *  - This is a lightweight regex scanner, not a full HTML/Vue parser.
 *    It is intentionally permissive: it will match tags inside comments
 *    or strings, which is acceptable for a doc-opening action.
 *  - If a `range` is provided, only tags whose `<` falls inside the
 *    range are returned.
 */
export function scanComponents(document: vscode.TextDocument, range?: vscode.Range): ComponentMatch[] {
  const text = document.getText();
  const results: ComponentMatch[] = [];
  const regex = /<(U[A-Z][A-Za-z0-9]*)\b/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const tagName = match[1];

    if (!isNuxtUiTag(tagName)) continue;

    const openOffset = match.index; // position of '<'
    const nameEndOffset = openOffset + 1 + tagName.length;
    const start = document.positionAt(openOffset);
    const end = document.positionAt(nameEndOffset);

    if (range && !range.contains(start)) {
      continue;
    }

    results.push({
      tagName,
      range: new vscode.Range(start, end),
      start,
    });
  }
  return results;
}
