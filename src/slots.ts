import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

// Invariant tail appended to every candidate base directory.
const COMPONENTS_TAIL = path.join('@nuxt', 'ui', 'dist', 'runtime', 'components');

// ─────────────────────────────────────────────────────────────────────────────
// Package-manager-specific base-path resolvers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * npm (v1–v9, workspaces included) and Yarn Classic (v1).
 *
 * Both managers use a flat `node_modules/` layout and hoist shared
 * dependencies to the monorepo root when workspaces are active.
 * The component declarations are therefore always reachable at:
 *
 *   <closest-ancestor-with-node_modules>/node_modules/@nuxt/ui/…
 *
 * We walk up the directory tree from `startDir` until we find an ancestor
 * whose `node_modules/@nuxt/ui/dist/runtime/components` exists.
 */
function resolveNpmBase(startDir: string): string | null {
  let dir = startDir;
  while (true) {
    const candidate = path.join(dir, 'node_modules', COMPONENTS_TAIL);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null; // reached filesystem root
    dir = parent;
  }
}

/**
 * pnpm (v7+, with or without workspaces).
 *
 * pnpm keeps a content-addressable virtual store under `node_modules/.pnpm/`
 * and creates a top-level symlink at `node_modules/@nuxt/ui` pointing into it.
 * `fs.readFileSync` follows symlinks transparently, so the standard npm walk
 * (resolveNpmBase) already handles the symlink case.
 *
 * This function is the fallback for the rare case where `shamefully-hoist` is
 * disabled and no top-level symlink was created (the package is not a direct
 * dependency of that workspace package).  It reads the virtual store directly:
 *
 *   <root>/node_modules/.pnpm/@nuxt+ui@<version>/node_modules/@nuxt/ui/…
 *
 * Directory names inside `.pnpm/` follow the pattern `@nuxt+ui@x.y.z` (with
 * optional peer suffix), so we scan for the first matching entry.
 */
function resolvePnpmBase(startDir: string): string | null {
  let dir = startDir;
  while (true) {
    const pnpmStore = path.join(dir, 'node_modules', '.pnpm');
    if (fs.existsSync(pnpmStore)) {
      try {
        const entries = fs.readdirSync(pnpmStore);
        // Virtual-store entries look like "@nuxt+ui@2.1.0" or "@nuxt+ui@2.1.0_peers"
        const entry = entries.find((e) => /^@nuxt\+ui@/.test(e));
        if (entry) {
          const candidate = path.join(pnpmStore, entry, 'node_modules', COMPONENTS_TAIL);
          if (fs.existsSync(candidate)) return candidate;
        }
      } catch {
        // permission error — skip this directory
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null; // reached filesystem root
    dir = parent;
  }
}

/**
 * Yarn Berry (v2 / v3 / v4).
 *
 * Yarn Berry supports two linker modes:
 *
 * a) `nodeLinker: node-modules` — identical layout to npm; resolveNpmBase
 *    already handles this and is tried before this function.
 *
 * b) Plug'n'Play (PnP) — packages are cached as zip archives inside
 *    `.yarn/cache/`.  Packages that need to be read as plain files (e.g.
 *    because a tool uses `fs.readFileSync`) must be "unplugged" — extracted
 *    to disk under `.yarn/unplugged/`.  @nuxt/ui is typically unplugged
 *    automatically or via `packageExtensions`.  The extracted path is:
 *
 *      <root>/.yarn/unplugged/@nuxt-ui-npm-<hash>/node_modules/@nuxt/ui/…
 *
 *    We scan `.yarn/unplugged/` for a directory whose name starts with
 *    `@nuxt-ui-npm-` (Yarn Berry's hash-based naming convention).
 */
function resolveYarnBase(startDir: string): string | null {
  let dir = startDir;
  while (true) {
    const unplugged = path.join(dir, '.yarn', 'unplugged');
    if (fs.existsSync(unplugged)) {
      try {
        const entries = fs.readdirSync(unplugged);
        // Unplugged directory names look like "@nuxt-ui-npm-<hash>"
        const entry = entries.find((e) => /^@nuxt-ui-npm-/.test(e));
        if (entry) {
          const candidate = path.join(unplugged, entry, 'node_modules', COMPONENTS_TAIL);
          if (fs.existsSync(candidate)) return candidate;
        }
      } catch {
        // permission error — skip this directory
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null; // reached filesystem root
    dir = parent;
  }
}

/**
 * Try all three resolvers in priority order and return the first match.
 *
 * Priority: npm/yarn-classic symlink walk → pnpm virtual store → yarn PnP.
 * The npm walk covers the most common cases (including pnpm with symlinks),
 * so it runs first to avoid unnecessary I/O.
 */
function resolveNuxtUiComponentsBase(startDir: string): string | null {
  return resolveNpmBase(startDir) ?? resolvePnpmBase(startDir) ?? resolveYarnBase(startDir);
}

// ─────────────────────────────────────────────────────────────────────────────

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
  console.log('Resolving slots for', componentName, 'in workspace root', root);
  if (!root) {
    return [];
  }

  const basePath = resolveNuxtUiComponentsBase(root);
  if (!basePath) {
    console.log('[nuxt-ui] Could not resolve @nuxt/ui components base path from', root);
    return [];
  }
  console.log('[nuxt-ui] Resolved components base path:', basePath);

  // Nuxt UI organises some components in sub-directories (e.g. dashboard/).
  // We try several candidate paths to cover all conventions.
  const candidates = buildCandidatePaths(basePath, componentName);
  console.log('[nuxt-ui] Candidate paths for', componentName, ':', candidates);

  for (const candidate of candidates) {
    try {
      const content = fs.readFileSync(candidate, 'utf8');
      const slots = parseSlots(content);
      if (slots.length > 0) {
        console.log('[nuxt-ui] Found definition at:', candidate);
        return slots;
      }
    } catch {
      // file not found — try next candidate
    }
  }

  console.log('[nuxt-ui] No definition found for', componentName);
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
 * Extract the first brace-delimited body after a type or interface declaration
 * matching `pattern` (e.g. `interface XxxSlots` or `type XxxProps`).
 *
 * Uses brace-depth tracking so it handles any level of nesting.
 */
function extractDeclBody(content: string, pattern: RegExp): string | null {
  const declStart = content.search(pattern);
  if (declStart === -1) return null;

  const bodyOpen = content.indexOf('{', declStart);
  if (bodyOpen === -1) return null;

  let depth = 1;
  let pos = bodyOpen + 1;
  while (pos < content.length && depth > 0) {
    if (content[pos] === '{') depth++;
    else if (content[pos] === '}') depth--;
    pos++;
  }
  return content.slice(bodyOpen + 1, pos - 1);
}

/**
 * Iteratively collapse all `{ ... }` blocks in `body` until stable.
 * This leaves only top-level declarations, preventing false matches on
 * inline type literals inside signatures.
 */
function flattenBraces(body: string): string {
  let flat = body;
  let prev: string;
  do {
    prev = flat;
    flat = flat.replace(/\{[^{}]*\}/g, '{}');
  } while (flat !== prev);
  return flat;
}

/**
 * Parse the content of a `.vue.d.ts` file and extract slot names from either:
 *   - `interface <Name>Slots { ... }`
 *   - `(export )type <Name>Slots<...> = { ... }`
 *
 * Handles both method-style slots (`slotName(props: {}): VNode[]`) and
 * property-style slots (`slotName?: SlotProps<T>`).
 */
function parseSlots(content: string): string[] {
  const body = extractDeclBody(content, /\b(?:type|interface)\s+\w+Slots\b/);
  if (!body) return [];

  const flat = flattenBraces(body);

  // Handles: slotName(   slotName?(   slotName?:   slotName:
  const slots: string[] = [];
  const slotRe = /^\s*(\w+)\s*\??\s*[:(]/gm;
  let m: RegExpExecArray | null;
  while ((m = slotRe.exec(flat)) !== null) {
    slots.push(m[1]);
  }
  return slots;
}

/**
 * Parse the content of a `.vue.d.ts` file and extract prop names from either:
 *   - `interface <Name>Props { ... }`
 *   - `(export )type <Name>Props<...> = { ... }`
 */
function parseProps(content: string): string[] {
  const body = extractDeclBody(content, /\b(?:type|interface)\s+\w+Props\b/);
  if (!body) return [];

  const flat = flattenBraces(body);

  // Only property-style declarations (props are never method signatures)
  const props: string[] = [];
  const propRe = /^\s*(\w+)\s*\??\s*:/gm;
  let m: RegExpExecArray | null;
  while ((m = propRe.exec(flat)) !== null) {
    props.push(m[1]);
  }
  return props;
}

/**
 * Reads the props defined in a Nuxt UI component's TypeScript declaration file.
 * Same resolution strategy as `readComponentSlots`.
 */
export function readComponentProps(componentName: string): string[] {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!root) return [];

  const basePath = resolveNuxtUiComponentsBase(root);
  if (!basePath) return [];

  const candidates = buildCandidatePaths(basePath, componentName);
  for (const candidate of candidates) {
    try {
      const content = fs.readFileSync(candidate, 'utf8');
      const props = parseProps(content);
      if (props.length > 0) {
        console.log('[nuxt-ui] Found props at:', candidate);
        return props;
      }
    } catch {
      // file not found — try next candidate
    }
  }
  return [];
}

/**
 * Parse the content of a `.vue.d.ts` file and extract the keys accepted by the
 * component's `ui` prop. Two strategies are tried in order:
 *
 * 1. Inline object literal: `ui?: { root?: string; item?: string; … }`
 *    (TypeScript sometimes fully expands indexed-access types in .d.ts output).
 *
 * 2. String literal union inside `Pick<…, 'k1' | 'k2' | …>` — these appear on
 *    item-level interfaces (e.g. `AccordionItem.ui`) and give at minimum a
 *    representative subset of valid ui keys.
 */
function parseUiKeys(content: string): string[] {
  // Strategy 1: ui?: { key?: T; … } inline object type
  const uiInlineRe = /\bui\s*\??\s*:\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = uiInlineRe.exec(content)) !== null) {
    const braceStart = m.index + m[0].length - 1; // the '{' at end of match
    let depth = 1;
    let pos = braceStart + 1;
    while (pos < content.length && depth > 0) {
      if (content[pos] === '{') depth++;
      else if (content[pos] === '}') depth--;
      pos++;
    }
    const body = content.slice(braceStart + 1, pos - 1);
    const flat = flattenBraces(body);
    const keys: string[] = [];
    const keyRe = /^\s*(\w+)\s*\??\s*:/gm;
    let km: RegExpExecArray | null;
    while ((km = keyRe.exec(flat)) !== null) {
      keys.push(km[1]);
    }
    if (keys.length > 0) return keys;
  }

  // Strategy 2: Pick<…, 'k1' | 'k2' | …> — union all string literal keys.
  // These appear on item-level ui types (e.g. AccordionItem.ui) and give at
  // minimum a useful representative subset.
  const pickRe = /Pick\s*<[^,>]+,\s*((?:'[^']+'\s*(?:\|\s*)?)+)>/g;
  const pickKeys: string[] = [];
  let pm: RegExpExecArray | null;
  while ((pm = pickRe.exec(content)) !== null) {
    const litRe = /'([^']+)'/g;
    let lm: RegExpExecArray | null;
    while ((lm = litRe.exec(pm[1])) !== null) {
      if (!pickKeys.includes(lm[1])) pickKeys.push(lm[1]);
    }
  }
  return pickKeys;
}

/**
 * Reads the ui-prop keys for a Nuxt UI component's TypeScript declaration file.
 * Same resolution strategy as `readComponentSlots`.
 */
export function readComponentUiKeys(componentName: string): string[] {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!root) return [];

  const basePath = resolveNuxtUiComponentsBase(root);
  if (!basePath) return [];

  const candidates = buildCandidatePaths(basePath, componentName);
  for (const candidate of candidates) {
    try {
      const content = fs.readFileSync(candidate, 'utf8');
      const keys = parseUiKeys(content);
      if (keys.length > 0) {
        console.log('[nuxt-ui] Found ui keys at:', candidate);
        return keys;
      }
    } catch {
      // file not found — try next candidate
    }
  }
  return [];
}
