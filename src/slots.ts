import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

/**
 * Reads the slots defined in a Nuxt UI component's TypeScript declaration file.
 *
 * The declaration files follow this naming convention:
 *   node_modules/@nuxt/ui/dist/runtime/components/<ComponentName>.vue.d.ts
 *
 * The `interface <Name>Slots { slotName(props?: {}): any; }` block is parsed
 * to extract all slot names.
 *
 * Returns an empty array when the file cannot be found or contains no slots.
 */
export function readComponentSlots(componentName: string): string[] {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!root) {
    return [];
  }

  const basePath = path.join(
    root,
    'node_modules',
    '@nuxt',
    'ui',
    'dist',
    'runtime',
    'components',
  );

  // Nuxt UI organises some components in sub-directories (e.g. dashboard/).
  // We try several candidate paths to cover all conventions.
  const candidates = buildCandidatePaths(basePath, componentName);

  for (const candidate of candidates) {
    try {
      const content = fs.readFileSync(candidate, 'utf8');
      const slots = parseSlots(content);
      if (slots.length > 0) {
        return slots;
      }
    } catch {
      // file not found — try next candidate
    }
  }

  return [];
}

/**
 * Generate candidate file paths for a component name.
 * Handles flat layout (`Card.vue.d.ts`) and potential sub-directory layouts
 * (`dashboard/Navbar.vue.d.ts` for `DashboardNavbar`).
 */
function buildCandidatePaths(basePath: string, componentName: string): string[] {
  const extensions = ['.vue.d.ts', '.d.vue.ts'];

  const candidates: string[] = [];

  // 1. Flat: <ComponentName>.vue.d.ts
  for (const ext of extensions) {
    candidates.push(path.join(basePath, `${componentName}${ext}`));
  }

  // 2. Sub-directory: if the name starts with a known prefix,
  //    try  <prefix>/<RestOfName>.vue.d.ts  (e.g. Dashboard/Navbar)
  const prefixMatch = componentName.match(/^([A-Z][a-z]+)([A-Z].+)$/);
  if (prefixMatch) {
    const [, prefix, rest] = prefixMatch;
    for (const ext of extensions) {
      candidates.push(path.join(basePath, prefix.toLowerCase(), `${rest}${ext}`));
      candidates.push(path.join(basePath, prefix, `${rest}${ext}`));
    }
  }

  return candidates;
}

/**
 * Parse the content of a `.vue.d.ts` file and extract slot names from the
 * `interface <Name>Slots { ... }` block.
 */
function parseSlots(content: string): string[] {
  // Match the entire Slots interface body (supports multi-line)
  const match = content.match(/interface\s+\w+Slots\s*\{([\s\S]*?)\}/);
  if (!match) {
    return [];
  }

  const body = match[1];
  const slots: string[] = [];
  // Each slot is a method declaration: slotName(props?: {}): any;
  const methodRe = /^\s*(\w+)\s*\(/gm;
  let m: RegExpExecArray | null;
  while ((m = methodRe.exec(body)) !== null) {
    slots.push(m[1]);
  }
  return slots;
}
