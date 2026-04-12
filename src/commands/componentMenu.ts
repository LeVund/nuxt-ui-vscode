import * as vscode from 'vscode';
import { DocPanel, ComponentContext } from '../webview/panel';

interface ActionItem extends vscode.QuickPickItem {
  action: 'openDocs';
}

/**
 * Opens a QuickPick listing the actions available for a given component.
 * When `context` is provided (tag URI + offset), the panel will also show
 * the slot-insertion panel for the component.
 */
export async function showComponentMenu(tagName: string, panel: DocPanel, context?: ComponentContext): Promise<void> {
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

  void panel.openComponent(tagName, context);
}
