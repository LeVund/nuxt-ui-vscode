import { DocPanel, ComponentContext } from '../webview/panel';

/**
 * Opens a QuickPick listing the actions available for a given component.
 * When `context` is provided (tag URI + offset), the panel will also show
 * the slot-insertion panel for the component.
 */
export async function showComponentMenu(tagName: string, panel: DocPanel, context?: ComponentContext): Promise<void> {
  if (!tagName) {
    return;
  }

  void panel.openComponent(tagName, context);
}
