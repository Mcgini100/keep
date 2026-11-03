/** Append clipboard content and leave a blank insertion point for the next link. */
export function appendClipboard(text: string, clipboard: string): string {
  const existing = text.trimEnd();
  return `${existing ? `${existing}\n` : ''}${clipboard.trimEnd()}\n`;
}

/** Add a newline after a link inserted by the keyboard's paste action. */
export function newlineAfterLinkInsertion(previous: string, next: string, start: number, end: number, containsLink: (text: string) => boolean) {
  const count = next.length - (previous.length - (end - start));
  const inserted = count > 1 ? next.slice(start, start + count) : '';
  if (next.slice(0, start) !== previous.slice(0, start) ||
      next.slice(start + count) !== previous.slice(end) ||
      !containsLink(inserted) || inserted.endsWith('\n')) return null;
  const cursor = start + count + 1;
  return { text: `${next.slice(0, cursor - 1)}\n${next.slice(cursor - 1)}`, cursor };
}
