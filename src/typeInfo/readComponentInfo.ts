import * as vscode from 'vscode';
import type { ComponentInfo } from '../core/types';
import { resolveUiKeys } from './resolveUiKeys';

async function loadDocumentSymbols(uri: vscode.Uri): Promise<{ symbols: vscode.DocumentSymbol[]; text: string }> {
  let doc: vscode.TextDocument;
  try {
    doc = await vscode.workspace.openTextDocument(uri);
  } catch {
    return { symbols: [], text: '' };
  }

  try {
    const symbols =
      (await vscode.commands.executeCommand<vscode.DocumentSymbol[]>('vscode.executeDocumentSymbolProvider', uri)) ?? [];
    return { symbols, text: doc.getText() };
  } catch {
    return { symbols: [], text: doc.getText() };
  }
}

function extractTopLevelKeys(text: string, blockPattern: RegExp): string[] {
  const startMatch = text.match(blockPattern);
  if (!startMatch || startMatch.index === undefined) return [];

  let depth = 1;
  let i = startMatch.index + startMatch[0].length;
  const blockStart = i;
  while (i < text.length && depth > 0) {
    if (text[i] === '{' || text[i] === '(') depth++;
    else if (text[i] === '}' || text[i] === ')') depth--;
    i++;
  }
  const block = text.slice(blockStart, i - 1);

  const keys: string[] = [];
  depth = 0;
  let lineStart = 0;
  for (let j = 0; j <= block.length; j++) {
    const ch = block[j];
    if (ch === '{' || ch === '(') depth++;
    else if (ch === '}' || ch === ')') depth--;
    else if ((ch === ';' || ch === '\n' || j === block.length) && depth === 0) {
      const line = block.slice(lineStart, j).trim();
      const nameMatch = line.match(/^(\w+)\s*\??\s*[:(]/);
      if (nameMatch) keys.push(nameMatch[1]);
      lineStart = j + 1;
    }
  }
  return keys;
}

function resolveSlots(slotsSymbol: vscode.DocumentSymbol | undefined, text: string): string[] {
  const fromSymbols = slotsSymbol?.children.map((c) => c.name) ?? [];
  return fromSymbols.length > 0 ? fromSymbols : extractTopLevelKeys(text, /(?:interface|type)\s+\w*Slots[^{]*\{/);
}

function resolveProps(propsSymbol: vscode.DocumentSymbol | undefined): {
  props: string[];
  hasUi: boolean;
  eventsFromProps: string[];
} {
  const allProps =
    propsSymbol?.children.map((c) => ({ ...c, name: c.name.replaceAll('"', '') })).filter((c) => c.name !== 'ui') ?? [];
  const isEvent = (name: string) => name.startsWith('on') && name[2] !== undefined && name[2] === name[2].toUpperCase();

  return {
    props: allProps.filter((c) => !isEvent(c.name)).map((c) => c.name),
    hasUi: propsSymbol?.children.some((c) => c.name === 'ui') ?? false,
    eventsFromProps: allProps.filter((c) => isEvent(c.name)).map((c) => c.name.slice(2)),
  };
}

function resolveEvents(emitsSymbol: vscode.DocumentSymbol | undefined, text: string, eventsFromProps: string[]): string[] {
  const fromEmits = emitsSymbol?.children.map((c) => c.name.replaceAll("'", '')) ?? [];
  const fromText = extractEventsFromText(text);
  return [...eventsFromProps, ...fromEmits, ...fromText];
}

function extractEventsFromText(text: string): string[] {
  const regex = /"on([A-Z][^"]*)"[?]?\s*:/g;
  const events: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    events.push(match[1]);
  }
  return events;
}

export async function readComponentInfo(declarationFilePath: string): Promise<ComponentInfo> {
  const uri = vscode.Uri.file(declarationFilePath);
  const { symbols, text } = await loadDocumentSymbols(uri);

  if (symbols.length === 0) return { slots: [], props: [], events: [], uiKeys: [] };

  const propsSymbol = symbols.find((s) => s.name.endsWith('Props'));
  const slotsSymbol = symbols.find((s) => s.name.endsWith('Slots'));
  const emitsSymbol = symbols.find((s) => s.name.endsWith('Emits'));

  const slots = resolveSlots(slotsSymbol, text);
  const { props, hasUi, eventsFromProps } = resolveProps(propsSymbol);
  const events = resolveEvents(emitsSymbol, text, eventsFromProps);
  const uiKeys = hasUi ? await resolveUiKeys(uri) : [];

  return {
    slots: [...new Set(slots.map((s) => s.toLowerCase()))],
    props: [...new Set(props.map((p) => p.toLowerCase()))],
    events: [...new Set(events.map((e) => e.toLowerCase()))],
    uiKeys: [...new Set(uiKeys.map((k) => k.toLowerCase()))],
  };
}
