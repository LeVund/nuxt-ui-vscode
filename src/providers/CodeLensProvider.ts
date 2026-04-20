import * as vscode from 'vscode';
import { Commands } from '../commands/commandIds.enum';
import { scanComponents } from '../parsing/scanComponents';

/**
 * Shows a CodeLens above each line that contains a Nuxt UI component tag.
 * Clicking it runs `nuxtUiCodeLens.openDocPanel` with the tag context.
 *
 * When a line contains multiple Nuxt UI tags, one CodeLens per tag is shown.
 */
export class NuxtUiCodeLensProvider implements vscode.CodeLensProvider {
  private readonly _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChange.event;

  /** Force a refresh of all code lenses (e.g. when the setting changes). */
  refresh(): void {
    this._onDidChange.fire();
  }

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const enabled = vscode.workspace.getConfiguration('nuxtUiCodeLens').get<boolean>('codeLens.enabled', true);
    if (!enabled) {
      return [];
    }

    const matches = scanComponents(document);
    return matches.map((match) => {
      const lineRange = new vscode.Range(match.start.line, 0, match.start.line, 0);
      return new vscode.CodeLens(lineRange, {
        title: `$(telescope)  ${match.tagName}`,
        tooltip: `Open Nuxt UI docs for ${match.tagName}`,
        command: Commands.OpenDocPanel,
        arguments: [match.tagName, document.uri.toString(), document.offsetAt(match.start)],
      });
    });
  }

  dispose(): void {
    this._onDidChange.dispose();
  }
}
