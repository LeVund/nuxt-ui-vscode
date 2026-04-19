import * as vscode from 'vscode';
import type { ComponentInfo, PropInfo, SlotInfo } from '../core/types';
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

/**
 * Extract slot binding names from the declaration text.
 * Matches patterns like: `slotName?(props: { key1: type1; key2: type2 }): VNode[]`
 */
function resolveSlotBindings(text: string): Map<string, string[]> {
  const bindings = new Map<string, string[]>();
  // Match slot definitions: name?(props: { ... }): VNode[]
  const slotRegex = /(\w+)\?\s*\(\s*props\s*:\s*\{([^}]*)\}\s*\)/g;
  let match: RegExpExecArray | null;
  while ((match = slotRegex.exec(text)) !== null) {
    const slotName = match[1];
    const propsBlock = match[2];
    const keys: string[] = [];
    const propRegex = /(\w+)\s*[?]?\s*:/g;
    let propMatch: RegExpExecArray | null;
    while ((propMatch = propRegex.exec(propsBlock)) !== null) {
      keys.push(propMatch[1]);
    }
    // Merge if same slot appears multiple times (e.g. in type alias + interface)
    const existing = bindings.get(slotName) ?? [];
    bindings.set(slotName, [...new Set([...existing, ...keys])]);
  }
  return bindings;
}

/**
 * Extract which props reference variant types.
 * Matches patterns like: `color?: Component['variants']['color']`
 * Returns a map from prop name to variant key name.
 */
function resolveVariantProps(text: string): Map<string, string> {
  const variantProps = new Map<string, string>();
  const regex = /(\w+)\??\s*:\s*\w+\['variants'\]\['(\w+)'\]/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    variantProps.set(match[1], match[2]);
  }
  return variantProps;
}

/**
 * Follow the theme import in the declaration file and extract variant values.
 * Returns a map from variant key (e.g. 'color') to its possible values.
 */
async function resolveVariantValues(declarationUri: vscode.Uri): Promise<Map<string, string[]>> {
  const variants = new Map<string, string[]>();

  const document = await vscode.workspace.openTextDocument(declarationUri);
  const text = document.getText();

  const themeImportMatch = text.match(/import\s+theme\s+from\s+['"](.+)['"]/);
  if (!themeImportMatch) return variants;

  const themePosition = document.positionAt(text.indexOf(themeImportMatch[0]) + themeImportMatch[0].indexOf('theme'));

  const locations = await vscode.commands.executeCommand<(vscode.Location | vscode.LocationLink)[]>(
    'vscode.executeDefinitionProvider',
    declarationUri,
    themePosition,
  );
  if (!locations?.length) return variants;

  const loc = locations[0];
  const themeUri = 'targetUri' in loc ? loc.targetUri : loc.uri;

  try {
    await vscode.workspace.openTextDocument(themeUri);
  } catch {
    return variants;
  }

  const symbols =
    (await vscode.commands.executeCommand<vscode.DocumentSymbol[]>('vscode.executeDocumentSymbolProvider', themeUri)) ?? [];

  const defaultSymbol = symbols.find((s) => s.name === 'default');
  const variantsSymbol = defaultSymbol?.children?.find((s) => s.name === '"variants"');
  if (!variantsSymbol?.children) return variants;

  for (const variantGroup of variantsSymbol.children) {
    const key = variantGroup.name.replaceAll('"', '');
    const values = variantGroup.children?.map((c) => c.name.replaceAll('"', '')) ?? [];
    // Skip boolean-like variants (true/false) and internal ones like fieldGroup
    if (values.length > 0 && !values.every((v) => v === 'true' || v === 'false')) {
      variants.set(key, values);
    }
  }

  return variants;
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

  const slotNames = resolveSlots(slotsSymbol, text);
  const slotBindingsMap = resolveSlotBindings(text);
  const { props, hasUi, eventsFromProps } = resolveProps(propsSymbol);
  const events = resolveEvents(emitsSymbol, text, eventsFromProps);

  // Resolve variant values from the theme file and match to props
  const variantPropsMap = resolveVariantProps(text);
  const variantValues = variantPropsMap.size > 0 ? await resolveVariantValues(uri) : new Map<string, string[]>();
  const uiKeys = hasUi ? await resolveUiKeys(uri) : [];

  const dedupedSlots = [...new Set(slotNames.map((s) => s.toLowerCase()))];
  const slots: SlotInfo[] = dedupedSlots.map((name) => ({
    name,
    bindings: slotBindingsMap.get(name) ?? [],
  }));

  const dedupedProps = [...new Set(props.map((p) => p.toLowerCase()))];
  const propsInfo: PropInfo[] = dedupedProps.map((name) => {
    const variantKey = variantPropsMap.get(name);
    const values = variantKey ? variantValues.get(variantKey) ?? [] : [];
    return { name, values };
  });

  return {
    slots,
    props: propsInfo,
    events: [...new Set(events.map((e) => e.toLowerCase()))],
    uiKeys: [...new Set(uiKeys.map((k) => k.toLowerCase()))],
  };
}
