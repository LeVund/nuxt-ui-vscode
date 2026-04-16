import * as vscode from 'vscode';

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
export async function resolveUiKeys(uri: vscode.Uri, position: vscode.Position): Promise<string[]> {
  const hovers = (await vscode.commands.executeCommand<vscode.Hover[]>('vscode.executeHoverProvider', uri, position)) ?? [];

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
