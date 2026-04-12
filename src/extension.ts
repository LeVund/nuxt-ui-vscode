import * as vscode from 'vscode';
import { VersionService } from './version';
import { DocPanel } from './webview/panel';
import { NuxtUiInlayHintsProvider } from './providers/inlayHints';
import { NuxtUiHoverProvider } from './providers/hover';
import { showComponentMenu } from './commands/componentMenu';
import { pickAndOpenComponent } from './commands/openComponent';
import { Commands } from './commands/commandIds.enum';

const VUE_SELECTOR: vscode.DocumentSelector = { language: 'vue', scheme: 'file' };

export function activate(context: vscode.ExtensionContext): void {
  const version = new VersionService();
  context.subscriptions.push(version);

  const panel = new DocPanel(version);

  // Providers
  const inlayHints = new NuxtUiInlayHintsProvider();
  context.subscriptions.push(
    inlayHints,
    vscode.languages.registerInlayHintsProvider(VUE_SELECTOR, inlayHints),
    vscode.languages.registerHoverProvider(VUE_SELECTOR, new NuxtUiHoverProvider()),
  );

  // Refresh inlay hints when relevant settings change
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('nuxtUi.inlayHints.enabled')) {
        inlayHints.refresh();
      }
    }),
  );

  // Commands declared in package.json
  context.subscriptions.push(
    vscode.commands.registerCommand(Commands.OpenHome, () => {
      // panel.openHome();
    }),
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
      // TEST
      // const uri = vscode.Uri.parse(docUriStr);
      // // tagOffset points to '<'; the tag name starts one character later.
      // const document = await vscode.workspace.openTextDocument(uri);
      // const namePosition = document.positionAt(tagOffset + 1);
      // const locations = await vscode.commands.executeCommand<vscode.LocationLink[]>(
      //   'vscode.executeDefinitionProvider',
      //   uri,
      //   namePosition,
      // );

      // console.log('--------------');
      // console.log('--------------');
      // console.log('--------------');
      // console.log({ locations });
      // console.log('--------------');
      // console.log('--------------');
      // console.log('--------------');

      // END TEST
      const ctx = { documentUri: vscode.Uri.parse(docUriStr), tagOffset, tagName };
      await panel.openComponent(tagName, ctx);
    }),
  );
}

export function deactivate(): void {
  // Nothing to clean up — all disposables are registered in context.subscriptions.
}
