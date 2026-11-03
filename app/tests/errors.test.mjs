import assert from 'node:assert/strict';
import test from 'node:test';
import { friendlyError } from '../src/lib/errors.ts';

test('403 with cookies is not incorrectly diagnosed as missing login', () => {
  assert.match(friendlyError('Loading cookies\nERROR: HTTP Error 403: Forbidden'), /rejected the media request/);
});
test('Instagram checkpoints ask for account verification', () => {
  assert.match(friendlyError('ERROR: challenge_required; login required', 'instagram'), /account verification/);
});
test('rate limiting takes precedence over login advice', () => {
  assert.match(friendlyError('ERROR: login required; HTTP 429', 'instagram'), /limiting requests/);
});
test('unknown failures summarize the actual error rather than the debug preamble', () => {
  assert.equal(friendlyError('yt-dlp 2026.01.01\n[debug] Python\nERROR: unexpected failure'), 'unexpected failure');
});
test('runtime failure is distinguished from an unavailable video', () => {
  assert.match(friendlyError('WARNING: No supported JavaScript runtime\nERROR: Video unavailable'), /player challenge/);
});
test('empty and very long errors remain readable', () => {
  assert.equal(friendlyError(undefined), 'Download failed.');
  assert.ok(friendlyError('x'.repeat(500)).length <= 160);
  assert.ok(friendlyError('x'.repeat(500)).endsWith('…'));
});

test('debug command cookie options do not turn unrelated failures into login errors', () => {
  assert.equal(friendlyError("yt-dlp 2026.01.01\n[debug] Command-line config: ['--cookies', 'cookies.txt']\nERROR: unexpected failure"), 'unexpected failure');
});
