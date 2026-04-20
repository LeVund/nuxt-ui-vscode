import type { ParsedTag } from '../core/types';

export function getParsedTag(text: string, tagStart: number, tagName: string): ParsedTag | undefined {
  let i = tagStart + 1 + tagName.length;
  let isInString: string | null = null; // Check if pointer is currently inside a string (to ignore > or /> inside strings)

  while (i < text.length) {
    const ch = text[i];

    if (isInString) {
      if (ch === isInString) isInString = null;
    } else if (ch === '"' || ch === "'") {
      isInString = ch;
    } else if (ch === '/' && i + 1 < text.length && text[i + 1] === '>') {
      return { openTagEnd: i + 2, selfClosing: true, closeCharIdx: i };
    } else if (ch === '>') {
      return { openTagEnd: i + 1, selfClosing: false, closeCharIdx: i };
    }

    i++;
  }
  return undefined;
}
