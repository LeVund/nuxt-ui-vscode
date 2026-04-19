import * as vscode from 'vscode';
import { VersionService } from './version/VersionService';
import { DocPanel } from './webview/DocPanel';
import { DocWebviewProvider } from './views/DocWebviewProvider';
import { registerProviders } from './activation/registerProviders';
import { registerCommands } from './activation/registerCommands';

export function activate(extensionContext: vscode.ExtensionContext): void {
  const version = new VersionService();
  extensionContext.subscriptions.push(version);

  const panel = new DocPanel(version);

  // Register the native TreeView for component info (props, slots, uiKeys)
  const treeView = vscode.window.createTreeView('nuxtUi.componentTree', {
    treeDataProvider: panel.treeProvider,
    showCollapseAll: true,
  });
  extensionContext.subscriptions.push(treeView);

  // Register the WebviewView for the documentation iframe
  extensionContext.subscriptions.push(
    vscode.window.registerWebviewViewProvider(DocWebviewProvider.VIEW_ID, panel.docWebviewProvider),
  );

  registerProviders(extensionContext);
  registerCommands(extensionContext, panel);
}

export function deactivate(): void {
  // Nothing to clean up — all disposables are registered in context.subscriptions.
}
