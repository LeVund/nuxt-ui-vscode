import * as vscode from 'vscode';
import { VersionService } from './version/VersionService';
import { DocPanel } from './webview/DocPanel';
import { registerProviders } from './activation/registerProviders';
import { registerCommands } from './activation/registerCommands';

export function activate(context: vscode.ExtensionContext): void {
  const version = new VersionService();
  context.subscriptions.push(version);

  const panel = new DocPanel(version);

  registerProviders(context);
  registerCommands(context, panel);
}

export function deactivate(): void {
  // Nothing to clean up — all disposables are registered in context.subscriptions.
}
