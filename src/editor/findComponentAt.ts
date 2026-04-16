import * as vscode from 'vscode';
import { scanComponents } from '../parsing/scanComponents';
import type { ComponentMatch } from '../core/types';

/**
 * Find the component tag at a given position. Used by the hover provider
 * to identify which component the cursor is over.
 */
export function findComponentAt(document: vscode.TextDocument, position: vscode.Position): ComponentMatch | undefined {
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
