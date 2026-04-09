import * as vscode from 'vscode';
import { isNuxtUiTag } from './components';

export interface ComponentMatch {
  /** Full tag name, including the `U` prefix (e.g. `UButton`). */
  tagName: string;
  /** Range covering the `<Tag` opening delimiter (without attributes). */
  range: vscode.Range;
  /** Position of the `<` character — useful as an inlay hint anchor. */
  start: vscode.Position;
}

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
export function scanComponents(
  document: vscode.TextDocument,
  range?: vscode.Range,
): ComponentMatch[] {
  const text = document.getText();
  const results: ComponentMatch[] = [];
  const regex = /<(U[A-Z][A-Za-z0-9]*)\b/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const tagName = match[1];
    if (!isNuxtUiTag(tagName)) {
      continue;
    }
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

/**
 * Find the component tag at a given position. Used by the hover provider
 * to identify which component the cursor is over.
 */
export function findComponentAt(
  document: vscode.TextDocument,
  position: vscode.Position,
): ComponentMatch | undefined {
  // Expand the search range to the current line only — enough to locate
  // the tag without scanning the entire document.
  const line = document.lineAt(position.line);
  const lineRange = line.range;
  const matches = scanComponents(document, lineRange);
  // Also include tags that started on a previous line but whose name
  // extends to this line — rare in practice, we ignore for simplicity.
  for (const m of matches) {
    // Hit if position is within the tag-name range (so hovering the
    // attributes or the closing `>` does not trigger).
    if (m.range.contains(position)) {
      return m;
    }
  }
  return undefined;
}
