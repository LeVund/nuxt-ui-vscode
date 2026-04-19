import * as vscode from 'vscode';
import { DocPanel } from '../webview/DocPanel';
import { Commands } from '../commands/commandIds.enum';
import type { ComponentTagFileContext } from '../core/types';
import { insertSlot } from '../insertions/insertSlot';
import { insertProp } from '../insertions/insertProp';
import { insertUiKey } from '../insertions/insertUiKey';

export function registerCommands(context: vscode.ExtensionContext, panel: DocPanel): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(Commands.OpenDocPanel, async (tagName: string, docUriStr: string, tagOffset: number) => {
      const ctx = { documentUri: vscode.Uri.parse(docUriStr), tagOffset, tagName };
      await panel.openComponent(ctx);
    }),

    vscode.commands.registerCommand(Commands.InsertSlot, async (ctx: ComponentTagFileContext, slotName: string) => {
      await insertSlot(ctx, slotName);
    }),

    vscode.commands.registerCommand(Commands.InsertProp, async (ctx: ComponentTagFileContext, propName: string) => {
      await insertProp(ctx, propName);
    }),

    vscode.commands.registerCommand(Commands.InsertUiKey, async (ctx: ComponentTagFileContext, keyName: string) => {
      await insertUiKey(ctx, keyName);
    }),
  );
}
