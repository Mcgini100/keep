import assert from 'node:assert/strict';
import test from 'node:test';
import { clampConcurrency, nextToStart } from '../src/lib/scheduler.ts';

const item = (id, status = 'pending') => ({ id, status, url: `u${id}`, platform: 'youtube', kind: 'video', quality: 'best', progress: 0, addedAt: 0 });

test('starts up to the limit, in queue order', () => {
  const items = [item('a'), item('b'), item('c'), item('d')];
  assert.deepEqual(nextToStart(items, new Set(), 3).map((i) => i.id), ['a', 'b', 'c']);
});
test('only fills the free slots', () => {
  const items = [item('a', 'downloading'), item('b', 'processing'), item('c'), item('d')];
  assert.deepEqual(nextToStart(items, new Set(['a', 'b']), 3).map((i) => i.id), ['c']);
});
test('never starts an item twice or a finished one', () => {
  const items = [item('a'), item('b', 'done'), item('c', 'failed'), item('d')];
  assert.deepEqual(nextToStart(items, new Set(['a']), 5).map((i) => i.id), ['d']);
});
test('limit of one keeps the old sequential behaviour', () => {
  const items = [item('a'), item('b')];
  assert.deepEqual(nextToStart(items, new Set(), 1).map((i) => i.id), ['a']);
  assert.deepEqual(nextToStart(items, new Set(['x']), 1), []);
});
test('lowering the limit below what is running starts nothing', () => {
  assert.deepEqual(nextToStart([item('d')], new Set(['a', 'b', 'c']), 2), []);
});
test('concurrency is clamped to 1..5 and survives bad saved values', () => {
  assert.equal(clampConcurrency(0), 1);
  assert.equal(clampConcurrency(9), 5);
  assert.equal(clampConcurrency(undefined), 3);
  assert.equal(clampConcurrency('2'), 2);
});
