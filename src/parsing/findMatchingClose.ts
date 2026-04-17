/**
 * Finds the index of the closing `</tagName>` that matches the opening tag ending at `fromIndex`.
 *
 * `fromIndex` must point to just after the opening `>`, so any `<tagName` found
 * beyond that point is necessarily a nested tag. Each nested open/close pair
 * increments then decrements `depth`, and the first `</tagName>` encountered
 * at `depth === 0` is the matching close.
 *
 * @param text - The full document text to search in.
 * @param tagName - The tag name to match (e.g. `"UCard"`).
 * @param fromIndex - Character index just after the opening tag's `>`.
 * @returns The index of the matching `</tagName>`, or `-1` if not found.
 */
export function findMatchingClose(text: string, tagName: string, fromIndex: number): number {
  const openRegExp = new RegExp(`<${tagName}\\b`, 'g');
  const closeRegExp = new RegExp(`<\\/${tagName}>`, 'g');

  openRegExp.lastIndex = fromIndex;
  closeRegExp.lastIndex = fromIndex;

  let depth = 0;
  let nextOpeningTag = openRegExp.exec(text);
  let nextClosingTag = closeRegExp.exec(text);

  while (nextClosingTag !== null) {
    const openingTagIdx = nextOpeningTag ? nextOpeningTag.index : Infinity;
    const closingTagIdx = nextClosingTag.index;

    if (openingTagIdx < closingTagIdx) {
      depth++;
      nextOpeningTag = openRegExp.exec(text);
    } else {
      if (depth === 0) return closingTagIdx;
      depth--;
      nextClosingTag = closeRegExp.exec(text);
    }
  }

  return -1;
}
