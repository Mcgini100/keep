import assert from 'node:assert/strict';
import test from 'node:test';
import { extractLinks } from '../src/lib/links.ts';
import { appendClipboard, newlineAfterLinkInsertion } from '../src/lib/paste.ts';

const insert = (before, after, start, end) => newlineAfterLinkInsertion(before, after, start, end, (value) => extractLinks(value).some((link) => !!link.platform));

test('paste button adds each copied link on a separate line', () => {
  const first = appendClipboard('', 'https://www.instagram.com/reel/abc/');
  assert.equal(appendClipboard(first, 'https://youtu.be/ABCDEFGHIJK'), 'https://www.instagram.com/reel/abc/\nhttps://youtu.be/ABCDEFGHIJK\n');
});
test('keyboard paste appends a newline and moves cursor', () => {
  const link = 'https://www.instagram.com/reel/abc/';
  assert.deepEqual(insert('', link, 0, 0), { text: `${link}\n`, cursor: link.length + 1 });
});
test('replacing a selection preserves surrounding text', () => {
  const link = 'https://www.instagram.com/reel/abc/';
  assert.deepEqual(insert('one old two', `one ${link} two`, 4, 7), { text: `one ${link}\n two`, cursor: 5 + link.length });
});
test('ordinary typing and already separated input remain unchanged', () => {
  assert.equal(insert('', 'x', 0, 0), null);
  assert.equal(insert('', 'https://www.instagram.com/reel/abc/\n', 0, 0), null);
});
