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
 * Extracts slot names from the `*Slots` type/interface block in the raw file text.
 * Handles generic type aliases (e.g. `type AccordionSlots<T> = { ... }`)
 * that the document symbol provider doesn't expose children for.
 */
function extractSlotsFromText(text: string): string[] {
  const startMatch = text.match(/(?:interface|type)\s+\w*Slots[^{]*\{/);
  if (!startMatch || startMatch.index === undefined) return [];

  // Find the matching closing brace, tracking nesting depth
  let depth = 1;
  let i = startMatch.index + startMatch[0].length;
  const blockStart = i;
  while (i < text.length && depth > 0) {
    if (text[i] === '{' || text[i] === '(') depth++;
    else if (text[i] === '}' || text[i] === ')') depth--;
    i++;
  }
  const block = text.slice(blockStart, i - 1);

  // Extract top-level property names only (depth 0 within the block)
  const slots: string[] = [];
  depth = 0;
  let lineStart = 0;
  for (let j = 0; j <= block.length; j++) {
    const ch = block[j];
    if (ch === '{' || ch === '(') depth++;
    else if (ch === '}' || ch === ')') depth--;
    else if ((ch === ';' || ch === '\n' || j === block.length) && depth === 0) {
      const line = block.slice(lineStart, j).trim();
      const nameMatch = line.match(/^(\w+)\s*\??\s*[:(]/);
      if (nameMatch) slots.push(nameMatch[1]);
      lineStart = j + 1;
    }
  }
  return slots;
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

  const slotsFromSymbols = slotsSymbol?.children.map((c) => c.name) ?? [];
  const slots = slotsFromSymbols.length > 0 ? slotsFromSymbols : extractSlotsFromText(text);
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
