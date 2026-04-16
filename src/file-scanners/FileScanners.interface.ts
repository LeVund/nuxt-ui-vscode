import * as vscode from 'vscode';

export interface ComponentMatch {
  /** Full tag name, including the `U` prefix (e.g. `UButton`). */
  tagName: string;
  /** Range covering the `<Tag` opening delimiter (without attributes). */
  range: vscode.Range;
  /** Position of the `<` character — useful as an inlay hint anchor. */
  start: vscode.Position;
}
