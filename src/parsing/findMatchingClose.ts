export function findMatchingClose(text: string, tagName: string, fromIndex: number): number {
  const openRe = new RegExp(`<${tagName}\\b`, 'g');
  const closeRe = new RegExp(`<\\/${tagName}>`, 'g');

  openRe.lastIndex = fromIndex;
  closeRe.lastIndex = fromIndex;

  let depth = 0;
  let nextOpen = openRe.exec(text);
  let nextClose = closeRe.exec(text);

  while (nextClose !== null) {
    const openIdx = nextOpen ? nextOpen.index : Infinity;
    const closeIdx = nextClose.index;

    if (openIdx < closeIdx) {
      depth++;
      nextOpen = openRe.exec(text);
    } else {
      if (depth === 0) return closeIdx;
      depth--;
      nextClose = closeRe.exec(text);
    }
  }

  return -1;
}
