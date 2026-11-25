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
test('recognizes X and Twitter post links and normalizes them to x.com', () => {
  const inputs = [
    'https://twitter.com/NASA/status/1790000000000000000',
    'https://mobile.twitter.com/NASA/status/1790000000000000000?s=20',
    'x.com/NASA/status/1790000000000000000',
    'https://www.x.com/i/web/status/1790000000000000000',
  ];
  for (const input of inputs) {
    const [link] = extractLinks(input);
    assert.equal(link.platform, 'x', input);
    assert.match(link.url, /^https:\/\/x\.com\//);
  }
  assert.equal(extractLinks(inputs.join('\n')).length, 1);
});
test('keeps separate videos within one X post', () => {
  const links = extractLinks('x.com/a/status/123/video/1 x.com/a/status/123/video/2 x.com/a/status/123');
  assert.equal(links.length, 2);
});
test('does not treat profiles, other hosts or look-alikes as X posts', () => {
  assert.equal(detectPlatform('https://x.com/NASA'), null);
  assert.equal(detectPlatform('https://x.com.evil.example/a/status/1'), null);
  assert.equal(extractLinks('see netflix.com/a/status/123').length, 0);
});
