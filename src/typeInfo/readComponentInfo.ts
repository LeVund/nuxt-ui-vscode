import * as vscode from 'vscode';
import type { ComponentInfo } from '../core/types';
import { resolveUiKeys } from './resolveUiKeys';

/**
 * Reads slots, props, and ui keys from a `.vue.d.ts` file using the VSCode
 * document symbol provider, which delegates to the active TypeScript / Volar
 * language server. No manual regex parsing of the file is required.
 *
 * - Slots  → children of the `*Slots` interface/type symbol.
 * - Props  → children of the `*Props` interface/type symbol.
 * - UI keys → children inferred from the `ui` prop type via the hover provider.
 */
export async function readComponentInfo(declarationFilePath: string): Promise<ComponentInfo> {
  const uri = vscode.Uri.file(declarationFilePath);

  try {
    await vscode.workspace.openTextDocument(uri);
  } catch (err) {
    return { slots: [], props: [], uiKeys: [] };
  }

  let symbols: vscode.DocumentSymbol[];
  try {
    symbols = (await vscode.commands.executeCommand<vscode.DocumentSymbol[]>('vscode.executeDocumentSymbolProvider', uri)) ?? [];
  } catch (err) {
    return { slots: [], props: [], uiKeys: [] };
  }

  const propsSymbol = symbols.find((s) => s.name.endsWith('Props'));
  const slotsSymbol = symbols.find((s) => s.name.endsWith('Slots'));

  const slots = slotsSymbol?.children.map((c) => c.name) ?? [];
  const props = propsSymbol?.children.map((c) => c.name) ?? [];

  let uiKeys: string[] = [];
  const uiProp = propsSymbol?.children.find((c) => c.name === 'ui');
  if (uiProp) {
    uiKeys = await resolveUiKeys(uri, uiProp.selectionRange.start);
  }

  return { slots, props, uiKeys };
}
