import * as vscode from 'vscode';
import { NuxtUiInlayHintsProvider } from '../providers/InlayHintsProvider';
import { NuxtUiHoverProvider } from '../providers/HoverProvider';

const VUE_SELECTOR: vscode.DocumentSelector = { language: 'vue', scheme: 'file' };

export function registerProviders(context: vscode.ExtensionContext): void {
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
}
