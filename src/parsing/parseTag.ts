import type { ParsedTag } from '../core/types';

export function getParsedTag(text: string, tagStart: number, tagName: string): ParsedTag | undefined {
  let i = tagStart + 1 + tagName.length;
  let inString: string | null = null;

  while (i < text.length) {
    const ch = text[i];
    if (inString) {
      if (ch === inString) inString = null;
    } else if (ch === '"' || ch === "'") {
      inString = ch;
    } else if (ch === '/' && i + 1 < text.length && text[i + 1] === '>') {
      return { openTagEnd: i + 2, selfClosing: true, closeCharIdx: i };
    } else if (ch === '>') {
      return { openTagEnd: i + 1, selfClosing: false, closeCharIdx: i };
    }
    i++;
  }
  return undefined;
}
