import * as vscode from 'vscode';
import { NUXT_UI_TAG_NAMES } from '../utils/syntaxUtils';
import { DocPanel } from '../webview/panel';

/**
 * Shows a QuickPick listing every known Nuxt UI component. Used by the
 * `nuxtUi.openComponent` command exposed in the command palette.
 *
 * The user can type a tag name (e.g. `UButton`) and VS Code's built-in
 * fuzzy matcher will narrow the list.
 */
export async function pickAndOpenComponent(panel: DocPanel): Promise<void> {
  const items: vscode.QuickPickItem[] = NUXT_UI_TAG_NAMES.map((tag) => ({
    label: tag,
  }));

  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: 'Search a Nuxt UI component (e.g. UButton, UCheckbox)…',
    matchOnDescription: true,
  });
  if (!picked) {
    return;
  }
  panel.openComponent(picked.label);
}
