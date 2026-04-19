import * as vscode from 'vscode';
import { DocPanel } from '../webview/DocPanel';
import { Commands } from '../commands/commandIds.enum';

export function registerCommands(context: vscode.ExtensionContext, panel: DocPanel): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(Commands.OpenDocPanel, async (tagName: string, docUriStr: string, tagOffset: number) => {
      const ctx = { documentUri: vscode.Uri.parse(docUriStr), tagOffset, tagName };
      await panel.openComponent(ctx);
    }),
  );
}
