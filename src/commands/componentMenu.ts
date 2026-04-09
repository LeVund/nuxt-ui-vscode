import * as vscode from 'vscode';
import { DocPanel } from '../webview/panel';

interface ActionItem extends vscode.QuickPickItem {
  action: 'openDocs';
}

/**
 * Opens a QuickPick listing the actions available for a given component.
 * Designed as the extension's main extensibility point: new features
 * (copy props, show variants, insert snippet, favorites, ...) should
 * be added as new items here.
 */
export async function showComponentMenu(
  tagName: string,
  panel: DocPanel,
): Promise<void> {
  if (!tagName) {
    return;
  }

  const items: ActionItem[] = [
    {
      label: '$(book) Open documentation',
      description: `ui.nuxt.com → ${tagName}`,
      action: 'openDocs',
    },
    // Future items go here.
  ];

  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: `Nuxt UI — ${tagName}`,
    matchOnDescription: true,
  });
  if (!picked) {
    return;
  }

  switch (picked.action) {
    case 'openDocs':
      panel.openComponent(tagName);
      return;
  }
}
