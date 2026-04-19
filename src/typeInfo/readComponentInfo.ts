import * as vscode from 'vscode';
import type { ComponentInfo } from '../core/types';
import { resolveUiKeys } from './resolveUiKeys';
import { log } from 'console';

async function loadDocumentSymbols(uri: vscode.Uri): Promise<{ symbols: vscode.DocumentSymbol[]; text: string }> {
  let doc: vscode.TextDocument;
  try {
    doc = await vscode.workspace.openTextDocument(uri);
  } catch {
    return { symbols: [], text: '' };
  }

  try {
    const symbols = (await vscode.commands.executeCommand<vscode.DocumentSymbol[]>('vscode.executeDocumentSymbolProvider', uri)) ?? [];
    return { symbols, text: doc.getText() };
  } catch {
    return { symbols: [], text: doc.getText() };
  }
}

/**
 * Extracts event names from `"onSomething"?:` patterns in the raw file text.
 * This catches events declared in `__VLS_export` / `__VLS_setup` props
 * that the document symbol provider doesn't expose.
 */
function extractEventsFromText(text: string): string[] {
  const regex = /"on([A-Z][^"]*)"[?]?\s*:/g;
  const events: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    events.push(match[1]);
  }
  return events;
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
  const { symbols, text } = await loadDocumentSymbols(uri);

  if (symbols.length === 0) return { slots: [], props: [], events: [], uiKeys: [] };

  const propsSymbol = symbols.find((s) => s.name.endsWith('Props'));
  const slotsSymbol = symbols.find((s) => s.name.endsWith('Slots'));
  const emitsSymbol = symbols.find((s) => s.name.endsWith('Emits'));

  const slots = slotsSymbol?.children.map((c) => c.name) ?? [];
  const allProps = propsSymbol?.children.map((c) => ({ ...c, name: c.name.replaceAll('"', '') })).filter((c) => c.name !== 'ui') ?? [];
  const isEvent = (name: string) => name.startsWith('on') && name[2] !== undefined && name[2] === name[2].toUpperCase();
  const props = allProps.filter((c) => !isEvent(c.name)).map((c) => c.name);

  const eventsFromProps = allProps.filter((c) => isEvent(c.name)).map((c) => c.name.slice(2));
  const eventsFromEmits = emitsSymbol?.children.map((c) => c.name.replaceAll("'", '')) ?? [];
  const eventsFromText = extractEventsFromText(text);
  const events = [...new Set([...eventsFromProps, ...eventsFromEmits, ...eventsFromText])];

  let uiKeys: string[] = [];
  const uiProp = propsSymbol?.children.find((c) => c.name === 'ui');

  if (uiProp) {
    uiKeys = await resolveUiKeys(uri);
  }

  return { slots, props, events, uiKeys };
}
