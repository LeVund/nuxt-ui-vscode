import * as vscode from 'vscode';
import { NuxtUiCodeLensProvider } from '../providers/CodeLensProvider';

const VUE_SELECTOR: vscode.DocumentSelector = { language: 'vue', scheme: 'file' };

export function registerProviders(context: vscode.ExtensionContext): void {
  const codeLens = new NuxtUiCodeLensProvider();
  context.subscriptions.push(
    codeLens,
    vscode.languages.registerCodeLensProvider(VUE_SELECTOR, codeLens),
  );

  // Refresh providers when relevant settings change
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('nuxtUiCodeLens.codeLens.enabled')) {
        codeLens.refresh();
      }
    }),
  );
}
