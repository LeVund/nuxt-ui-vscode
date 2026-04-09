import * as vscode from 'vscode';
import { scanComponents } from '../scanner';

/**
 * Shows a clickable `⚡` inlay hint immediately before the `<` of every
 * Nuxt UI component opening tag. Clicking it runs
 * `nuxtUi.showComponentMenu` with the tag name as argument.
 */
export class NuxtUiInlayHintsProvider implements vscode.InlayHintsProvider {
  private readonly _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChangeInlayHints = this._onDidChange.event;

  /** Force a refresh of all inlay hints (e.g. when the setting changes). */
  refresh(): void {
    this._onDidChange.fire();
  }

  provideInlayHints(
    document: vscode.TextDocument,
    range: vscode.Range,
  ): vscode.InlayHint[] {
    const enabled = vscode.workspace
      .getConfiguration('nuxtUi')
      .get<boolean>('inlayHints.enabled', true);
    if (!enabled) {
      return [];
    }

    const matches = scanComponents(document, range);
    return matches.map((match) => {
      const labelPart = new vscode.InlayHintLabelPart('⚡');
      labelPart.tooltip = new vscode.MarkdownString(
        `**${match.tagName}** — click for Nuxt UI actions`,
      );
      labelPart.command = {
        command: 'nuxtUi.showComponentMenu',
        title: 'Nuxt UI actions',
        arguments: [match.tagName],
      };

      const hint = new vscode.InlayHint(
        match.start,
        [labelPart],
        vscode.InlayHintKind.Parameter,
      );
      hint.paddingRight = true;
      return hint;
    });
  }

  dispose(): void {
    this._onDidChange.dispose();
  }
}
