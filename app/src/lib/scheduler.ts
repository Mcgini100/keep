import type { Item } from './types';

/** How many downloads may run side by side. */
export const MIN_CONCURRENCY = 1;
export const MAX_CONCURRENCY = 5;
export const DEFAULT_CONCURRENCY = 3;

export function clampConcurrency(n: unknown): number {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return DEFAULT_CONCURRENCY;
  return Math.min(MAX_CONCURRENCY, Math.max(MIN_CONCURRENCY, v));
}

/**
 * Picks the pending items to start now, in queue order, so that no more than
 * `limit` downloads run at once. Items already running are never picked twice.
 */
export function nextToStart(items: readonly Item[], running: ReadonlySet<string>, limit: number): Item[] {
  const free = clampConcurrency(limit) - running.size;
  if (free <= 0) return [];
  const out: Item[] = [];
  for (const it of items) {
    if (out.length >= free) break;
    if (it.status === 'pending' && !running.has(it.id)) out.push(it);
  }
  return out;
}
