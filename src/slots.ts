import * as vscode from 'vscode';

export interface ComponentInfo {
  slots: string[];
  props: string[];
  uiKeys: string[];
}

/**
 * Resolves the `.vue.d.ts` declaration file path from a path returned by
 * `vscode.executeTypeDefinitionProvider`. Volar typically points to the `.vue`
 * source file; the adjacent `.vue.d.ts` holds the type declarations.
 *
 * Returns `undefined` when the input path cannot be mapped to a `.vue.d.ts`.
 */
export function resolveDeclarationPath(definitionFsPath: string): string | undefined {
  if (definitionFsPath.endsWith('.vue.d.ts')) {
    return definitionFsPath;
  }
  if (definitionFsPath.endsWith('.vue')) {
    return `${definitionFsPath}.d.ts`;
  }
  return undefined;
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

  try {
    await vscode.workspace.openTextDocument(uri);
  } catch {
    return { slots: [], props: [], uiKeys: [] };
  }

  const symbols =
    (await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
      'vscode.executeDocumentSymbolProvider',
      uri,
    )) ?? [];

  const propsSymbol = symbols.find((s) => s.name.endsWith('Props'));
  const slotsSymbol = symbols.find((s) => s.name.endsWith('Slots'));

  const slots = slotsSymbol?.children.map((c) => c.name) ?? [];
  const props = propsSymbol?.children.map((c) => c.name) ?? [];

  // The `ui` prop has an inline object type — the symbol provider only gives us
  // its name. We use the hover provider on its position to get the full type
  // signature, then extract the key names from it.
  let uiKeys: string[] = [];
  const uiProp = propsSymbol?.children.find((c) => c.name === 'ui');
  if (uiProp) {
    uiKeys = await resolveUiKeys(uri, uiProp.selectionRange.start);
  }

  return { slots, props, uiKeys };
}

/**
 * Hovers over the `ui` property and parses the key names out of its inline
 * object type.
 *
 * The TypeScript hover text for `ui?: { root?: string; base?: string }` looks
 * like:
 *   ```
 *   (property) UButton.ui?: { root?: string; base?: string; … } | undefined
 *   ```
 * We extract the first `{ … }` block and collect every `key?:` / `key:` entry.
 */
async function resolveUiKeys(uri: vscode.Uri, position: vscode.Position): Promise<string[]> {
  const hovers =
    (await vscode.commands.executeCommand<vscode.Hover[]>(
      'vscode.executeHoverProvider',
      uri,
      position,
    )) ?? [];

  const text = hovers
    .flatMap((h) => h.contents)
    .map((c) => (typeof c === 'string' ? c : c.value))
    .join('\n');

  // Find the first `{…}` block in the hover text (the ui object type).
  const braceOpen = text.indexOf('{');
  if (braceOpen === -1) return [];

  let depth = 1;
  let pos = braceOpen + 1;
  while (pos < text.length && depth > 0) {
    if (text[pos] === '{') depth++;
    else if (text[pos] === '}') depth--;
    pos++;
  }

  const block = text.slice(braceOpen + 1, pos - 1);
  const keys: string[] = [];
  const keyRe = /^\s*(\w+)\s*\??\s*:/gm;
  let m: RegExpExecArray | null;
  while ((m = keyRe.exec(block)) !== null) {
    keys.push(m[1]);
  }
  return keys;
}
