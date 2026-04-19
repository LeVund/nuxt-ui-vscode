import * as vscode from 'vscode';
import type { ComponentInfo } from '../core/types';
import { resolveUiKeys } from './resolveUiKeys';
import { log } from 'console';

async function loadDocumentSymbols(uri: vscode.Uri): Promise<vscode.DocumentSymbol[]> {
  try {
    await vscode.workspace.openTextDocument(uri);
  } catch {
    return [];
  }

  try {
    return (await vscode.commands.executeCommand<vscode.DocumentSymbol[]>('vscode.executeDocumentSymbolProvider', uri)) ?? [];
  } catch {
    return [];
  }
}

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
  const symbols = await loadDocumentSymbols(uri);

  if (symbols.length === 0) return { slots: [], props: [], events: [], uiKeys: [] };

  const propsSymbol = symbols.find((s) => s.name.endsWith('Props'));
  const slotsSymbol = symbols.find((s) => s.name.endsWith('Slots'));

  const slots = slotsSymbol?.children.map((c) => c.name) ?? [];
  const allProps = propsSymbol?.children.filter((c) => c.name !== 'ui') ?? [];
  const props = allProps.filter((c) => !c.name.startsWith('on')).map((c) => c.name);
  const events = allProps.filter((c) => c.name.startsWith('on')).map((c) => c.name.slice(2));

  let uiKeys: string[] = [];
  const uiProp = propsSymbol?.children.find((c) => c.name === 'ui');

  if (uiProp) {
    uiKeys = await resolveUiKeys(uri);
  }

  return { slots, props, events, uiKeys };
}
