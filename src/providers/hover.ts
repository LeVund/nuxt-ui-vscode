import * as vscode from 'vscode';
import { findComponentAt } from '../scanner';
import { Commands } from '../commandIds';

/**
 * Shows a hover tooltip with quick action links on Nuxt UI component
 * tags. The links trigger the same command the inlay hint uses, giving
 * users two discoverable entry points.
 */
export class NuxtUiHoverProvider implements vscode.HoverProvider {
  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.Hover | undefined {
    const enabled = vscode.workspace
      .getConfiguration('nuxtUi')
      .get<boolean>('hover.enabled', true);
    if (!enabled) {
      return undefined;
    }

    const match = findComponentAt(document, position);
    if (!match) {
      return undefined;
    }

    const args = encodeURIComponent(JSON.stringify([match.tagName]));
    const md = new vscode.MarkdownString();
    md.isTrusted = true;
    md.supportHtml = false;
    md.appendMarkdown(`**${match.tagName}** — Nuxt UI component\n\n`);
    md.appendMarkdown(
      `[$(book) Open documentation](command:${Commands.OpenComponentByName}?${args})`,
    );
    md.appendMarkdown('  \u00A0·\u00A0  ');
    md.appendMarkdown(
      `[$(list-unordered) More actions…](command:${Commands.ShowComponentMenu}?${args})`,
    );

    return new vscode.Hover(md, match.range);
  }
}
