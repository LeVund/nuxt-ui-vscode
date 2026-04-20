export interface ParsedAttribute {
  /** Start index (within openTagText) of the attribute, including the leading whitespace. */
  fullStart: number;
  /** End index (exclusive) of the attribute, after the value. */
  fullEnd: number;
  /** Attribute name as written in the source (e.g. ':title', '@click', 'v-model:page-count'). */
  rawName: string;
}

export type AttributeKind = 'prop' | 'event' | 'vmodel';

export interface ClassifiedAttribute {
  kind: AttributeKind;
  /** Normalized key: lowercased, dashes stripped. For bare `v-model`, an empty string. */
  key: string;
}

const NAME_CHAR = /[A-Za-z0-9:@._-]/;

export function parseAttributes(openTagText: string, tagName: string): ParsedAttribute[] {
  const attrs: ParsedAttribute[] = [];
  let i = 1 + tagName.length;
  const n = openTagText.length;

  while (i < n) {
    const wsStart = i;
    while (i < n && /\s/.test(openTagText[i])) i++;
    if (i >= n) break;
    const ch = openTagText[i];
    if (ch === '>' || ch === '/') break;

    const nameStart = i;
    while (i < n && NAME_CHAR.test(openTagText[i]) && openTagText[i] !== '=') i++;
    const rawName = openTagText.slice(nameStart, i);
    if (!rawName) {
      i++;
      continue;
    }

    while (i < n && /\s/.test(openTagText[i])) i++;
    if (openTagText[i] === '=') {
      i++;
      while (i < n && /\s/.test(openTagText[i])) i++;
      const q = openTagText[i];
      if (q === '"' || q === "'") {
        i++;
        while (i < n && openTagText[i] !== q) i++;
        if (i < n) i++;
      } else {
        while (i < n && !/[\s>/]/.test(openTagText[i])) i++;
      }
    }

    attrs.push({ fullStart: wsStart, fullEnd: i, rawName });
  }
  return attrs;
}

export function normalizeKey(s: string): string {
  return s.toLowerCase().replaceAll('-', '');
}

function stripModifiers(name: string): string {
  const i = name.indexOf('.');
  return i === -1 ? name : name.slice(0, i);
}

export function classifyAttribute(rawName: string): ClassifiedAttribute | undefined {
  const name = stripModifiers(rawName);
  if (!name) return undefined;

  if (name.startsWith('@')) return { kind: 'event', key: normalizeKey(name.slice(1)) };
  if (name.startsWith('v-on:')) return { kind: 'event', key: normalizeKey(name.slice('v-on:'.length)) };

  if (name === 'v-model') return { kind: 'vmodel', key: '' };
  if (name.startsWith('v-model:')) return { kind: 'vmodel', key: normalizeKey(name.slice('v-model:'.length)) };

  if (name.startsWith(':')) return { kind: 'prop', key: normalizeKey(name.slice(1)) };
  if (name.startsWith('v-bind:')) return { kind: 'prop', key: normalizeKey(name.slice('v-bind:'.length)) };

  if (name.startsWith('v-')) return undefined;
  return { kind: 'prop', key: normalizeKey(name) };
}

export interface UsedAttrs {
  props: Set<string>;
  events: Set<string>;
  vModels: Set<string>;
}

export function detectUsed(attrs: ParsedAttribute[]): UsedAttrs {
  const used: UsedAttrs = { props: new Set(), events: new Set(), vModels: new Set() };
  for (const a of attrs) {
    const c = classifyAttribute(a.rawName);
    if (!c) continue;
    if (c.kind === 'prop') used.props.add(c.key);
    else if (c.kind === 'event') used.events.add(c.key);
    else used.vModels.add(c.key);
  }
  return used;
}

export function vModelKey(name: string): string {
  return name.toLowerCase() === 'modelvalue' ? '' : normalizeKey(name);
}
