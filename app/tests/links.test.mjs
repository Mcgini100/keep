import assert from 'node:assert/strict';
import test from 'node:test';
import { extractLinks, detectPlatform } from '../src/lib/links.ts';

test('accepts a standard Instagram reel share with tracking parameters', () => {
  const links = extractLinks('Watch https://www.instagram.com/reel/Chunk8-jurw/?igsh=abc');
  assert.equal(links.length, 1);
  assert.equal(links[0].platform, 'instagram');
  assert.equal(links[0].url, 'https://www.instagram.com/reel/Chunk8-jurw/?igsh=abc');
});
test('normalizes mobile and short Instagram domains for the extractor', () => {
  for (const input of ['https://m.instagram.com/reel/Chunk8-jurw/', 'instagr.am/reel/Chunk8-jurw/']) {
    const [link] = extractLinks(input);
    assert.equal(link.url, 'https://www.instagram.com/reel/Chunk8-jurw/');
    assert.equal(link.platform, 'instagram');
  }
});
test('deduplicates different Instagram share variants', () => {
  assert.equal(extractLinks('instagr.am/reel/Chunk8-jurw/ https://www.instagram.com/reel/Chunk8-jurw/?igsh=abc').length, 1);
});
test('does not recognize unrelated or spoofed hosts', () => {
  assert.equal(detectPlatform('https://instagram.com.example.org/reel/Chunk8-jurw/'), null);
});
