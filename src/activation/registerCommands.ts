import * as vscode from 'vscode';
import { DocPanel } from '../webview/DocPanel';
import { showComponentMenu } from '../commands/componentMenu';
import { pickAndOpenComponent } from '../commands/openComponent';
import { Commands } from '../commands/commandIds.enum';

export function registerCommands(context: vscode.ExtensionContext, panel: DocPanel): void {
  // Commands declared in package.json
  context.subscriptions.push(
    vscode.commands.registerCommand(Commands.OpenHome, () => {}),
    vscode.commands.registerCommand(Commands.OpenComponent, async () => {
      await pickAndOpenComponent(panel);
    }),
    vscode.commands.registerCommand(
      Commands.ShowComponentMenu,
      async (tagName: string, docUriStr?: string, tagOffset?: number) => {
        const ctx =
          typeof docUriStr === 'string' && typeof tagOffset === 'number'
            ? { documentUri: vscode.Uri.parse(docUriStr), tagOffset, tagName }
            : undefined;
        await showComponentMenu(tagName, panel, ctx);
      },
    ),
  );

  // Internal commands — not declared in package.json.
  context.subscriptions.push(
    vscode.commands.registerCommand(Commands.OpenComponentByName, (tagName: string) => {
      if (typeof tagName === 'string' && tagName.length > 0) {
        panel.openComponent(tagName);
      }
    }),
    vscode.commands.registerCommand(Commands.OpenFromVSCode, async (tagName: string, docUriStr: string, tagOffset: number) => {
      const ctx = { documentUri: vscode.Uri.parse(docUriStr), tagOffset, tagName };
      await panel.openComponent(tagName, ctx);
    }),
  );
}
