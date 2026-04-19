import * as vscode from 'vscode';
import { VersionService } from './version/VersionService';
import { DocPanel } from './webview/DocPanel';
import { registerProviders } from './activation/registerProviders';
import { registerCommands } from './activation/registerCommands';

export function activate(extensionContext: vscode.ExtensionContext): void {
  const version = new VersionService();
  extensionContext.subscriptions.push(version);

  const panel = new DocPanel(version);

  extensionContext.subscriptions.push(
    vscode.window.registerWebviewViewProvider(DocPanel.VIEW_ID, panel, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
  );

  registerProviders(extensionContext);
  registerCommands(extensionContext, panel);
}

export function deactivate(): void {
  // Nothing to clean up — all disposables are registered in context.subscriptions.
}
