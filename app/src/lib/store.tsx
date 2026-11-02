import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { Album, Asset, requestPermissionsAsync } from 'expo-media-library';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { Platform as RNPlatform } from 'react-native';

import { api, ApiError, authHeaders } from './api';
import type { ParsedLink } from './links';
import { ACTIVE, Item, Kind, Quality, Settings } from './types';

// --------------------------------------------------------------------------- //
// State
// --------------------------------------------------------------------------- //

const STORAGE_KEY = 'keep/state/v1';
const ALBUM = 'Keep';

/** How the single progress bar is split between the two phases. */
const FETCH_SHARE = 0.8;

export const defaultSettings: Settings = {
  serverUrl: '',
  apiKey: '',
  kind: 'video',
  quality: 'best',
  saveToPhotos: true,
  haptics: true,
  // iOS shows a paste banner every time the clipboard is read, so it's opt-in there.
  watchClipboard: RNPlatform.OS === 'android',
};

type State = {
  hydrated: boolean;
  paused: boolean;
  items: Item[];
  settings: Settings;
};

type Action =
  | { type: 'hydrate'; state: Partial<State> }
  | { type: 'add'; items: Item[] }
  | { type: 'patch'; id: string; patch: Partial<Item> }
  | { type: 'remove'; id: string }
  | { type: 'retry'; id: string }
  | { type: 'retryFailed' }
  | { type: 'clearFinished' }
  | { type: 'moveToTop'; id: string }
  | { type: 'pause'; paused: boolean }
  | { type: 'settings'; patch: Partial<Settings> };

const initial: State = { hydrated: false, paused: false, items: [], settings: defaultSettings };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'hydrate':
      return { ...state, ...action.state, hydrated: true };
    case 'add':
      return { ...state, items: [...state.items, ...action.items] };
    case 'patch':
      return {
        ...state,
        items: state.items.map((it) => (it.id === action.id ? { ...it, ...action.patch } : it)),
      };
    case 'remove':
      return { ...state, items: state.items.filter((it) => it.id !== action.id) };
    case 'retry':
      return {
        ...state,
        items: state.items.map((it) =>
          it.id === action.id ? { ...it, status: 'pending', progress: 0, error: null } : it,
        ),
      };
    case 'retryFailed':
      return {
        ...state,
        items: state.items.map((it) =>
          it.status === 'failed' || it.status === 'cancelled'
            ? { ...it, status: 'pending', progress: 0, error: null }
            : it,
        ),
      };
    case 'clearFinished':
      return {
        ...state,
        items: state.items.filter((it) => it.status !== 'failed' && it.status !== 'cancelled'),
      };
    case 'moveToTop': {
      const target = state.items.find((it) => it.id === action.id);
      if (!target) return state;
      return { ...state, items: [target, ...state.items.filter((it) => it.id !== action.id)] };
    }
    case 'pause':
      return { ...state, paused: action.paused };
    case 'settings':
      return { ...state, settings: { ...state.settings, ...action.patch } };
  }
}

// --------------------------------------------------------------------------- //
// Helpers
// --------------------------------------------------------------------------- //

const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

class Aborted extends Error {
  constructor() {
    super('aborted');
    this.name = 'AbortError';
  }
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new Aborted());
    const t = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new Aborted());
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

function libraryDir(): Directory {
  const dir = new Directory(Paths.document, 'Keep');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

async function saveToPhotos(uri: string): Promise<boolean> {
  const perm = await requestPermissionsAsync(true);
  if (!perm.granted) return false;
  const album = await Album.get(ALBUM);
  if (album) {
    await Asset.create(uri, album);
  } else {
    const asset = await Asset.create(uri);
    await Album.create(ALBUM, [asset], false);
  }
  return true;
}

export function deleteLocalFile(uri?: string | null) {
  if (!uri) return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // Already gone — nothing to do.
  }
}

// --------------------------------------------------------------------------- //
// Context
// --------------------------------------------------------------------------- //

type Ctx = State & {
  current: Item | undefined;
  pending: Item[];
  finished: Item[];
  library: Item[];
  enqueue: (links: ParsedLink[], kind: Kind, quality: Quality) => number;
  cancel: (id: string) => void;
  remove: (id: string) => void;
  retry: (id: string) => void;
  retryFailed: () => void;
  clearFinished: () => void;
  moveToTop: (id: string) => void;
  setPaused: (paused: boolean) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  tap: (style?: 'light' | 'success' | 'error') => void;
};

const QueueContext = createContext<Ctx | null>(null);

export function QueueProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);
  const stateRef = useRef(state);
  stateRef.current = state;

  const worker = useRef<{ id: string; controller: AbortController; jobId?: string } | null>(null);

  // ---- persistence -------------------------------------------------------- //
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) return dispatch({ type: 'hydrate', state: {} });
        const saved = JSON.parse(raw) as Partial<State>;
        // Anything mid-flight when the app closed starts again from the top.
        const items = (saved.items ?? []).map((it) =>
          ACTIVE.includes(it.status) ? { ...it, status: 'pending' as const, progress: 0 } : it,
        );
        dispatch({
          type: 'hydrate',
          state: {
            items,
            paused: saved.paused ?? false,
            settings: { ...defaultSettings, ...(saved.settings ?? {}) },
          },
        });
      } catch {
        dispatch({ type: 'hydrate', state: {} });
      }
    })();
  }, []);

  useEffect(() => {
    if (!state.hydrated) return;
    const t = setTimeout(() => {
      const { items, paused, settings } = state;
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ items, paused, settings })).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [state]);

  // ---- feedback ----------------------------------------------------------- //
  const tap = useCallback((style: 'light' | 'success' | 'error' = 'light') => {
    if (!stateRef.current.settings.haptics) return;
    if (style === 'light') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    else
      Haptics.notificationAsync(
        style === 'success' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error,
      ).catch(() => {});
  }, []);

  // ---- the sequential worker --------------------------------------------- //
  const process = useCallback(
    async (item: Item) => {
      const controller = new AbortController();
      const { signal } = controller;
      worker.current = { id: item.id, controller };
      const settings = stateRef.current.settings;
      const patch = (p: Partial<Item>) => dispatch({ type: 'patch', id: item.id, patch: p });

      patch({ status: 'fetching', progress: 0, error: null });

      try {
        // 1. Ask the engine to fetch the media.
        const created = await api.createJob(settings, item.url, item.kind, item.quality, signal);
        worker.current.jobId = created.id;

        let job = created;
        let misses = 0;
        while (job.status !== 'ready') {
          await sleep(900, signal);
          try {
            job = await api.job(settings, created.id, signal);
            misses = 0;
          } catch (e) {
            if (signal.aborted) throw e;
            if (++misses >= 5) throw e; // tolerate a few blips on a flaky network
            continue;
          }
          if (job.status === 'error') throw new ApiError(job.error || 'Download failed.', 500);
          if (job.status === 'cancelled') throw new Aborted();
          patch({
            progress: job.progress * FETCH_SHARE,
            speed: job.speed,
            title: job.title ?? undefined,
            thumbnail: job.thumbnail ?? undefined,
            uploader: job.uploader ?? undefined,
            duration: job.duration ?? undefined,
          });
        }

        // 2. Bring the file onto the phone.
        patch({ status: 'saving', progress: FETCH_SHARE, speed: null });
        const file = await File.downloadFileAsync(api.fileUrl(settings, created.id), libraryDir(), {
          headers: authHeaders(settings),
          idempotent: true,
          signal,
          onProgress: ({ bytesWritten, totalBytes }) => {
            const frac = totalBytes > 0 ? bytesWritten / totalBytes : 0;
            patch({ progress: FETCH_SHARE + frac * (1 - FETCH_SHARE) });
          },
        });

        // 3. File it in Photos (videos only — Photos doesn't take audio).
        let savedToPhotos = false;
        if (item.kind === 'video' && settings.saveToPhotos) {
          try {
            savedToPhotos = await saveToPhotos(file.uri);
          } catch {
            savedToPhotos = false;
          }
        }

        api.deleteJob(settings, created.id);
        patch({
          status: 'done',
          progress: 1,
          localUri: file.uri,
          size: file.size ?? job.filesize,
          title: job.title ?? item.title,
          thumbnail: job.thumbnail ?? item.thumbnail,
          uploader: job.uploader ?? item.uploader,
          duration: job.duration ?? item.duration,
          savedToPhotos,
          finishedAt: Date.now(),
        });
        tap('success');
      } catch (e) {
        const jobId = worker.current?.jobId;
        if (jobId) api.deleteJob(settings, jobId);
        if (signal.aborted) {
          // Cancel and pause both abort; the caller has already set the right status.
          return;
        }
        patch({ status: 'failed', error: (e as Error).message || 'Download failed.', speed: null });
        tap('error');
      } finally {
        if (worker.current?.id === item.id) worker.current = null;
      }
    },
    [tap],
  );

  // Pick up the next pending item whenever nothing is running.
  useEffect(() => {
    if (!state.hydrated || state.paused || worker.current) return;
    const next = state.items.find((it) => it.status === 'pending');
    if (next) process(next);
  }, [state.hydrated, state.paused, state.items, process]);

  // ---- actions ------------------------------------------------------------ //
  const enqueue = useCallback((links: ParsedLink[], kind: Kind, quality: Quality) => {
    const existing = new Set(
      stateRef.current.items.filter((i) => i.status !== 'done').map((i) => `${i.url}|${i.kind}`),
    );
    const items: Item[] = links
      .filter((l) => l.platform && !existing.has(`${l.url}|${kind}`))
      .map((l) => ({
        id: uid(),
        url: l.url,
        platform: l.platform!,
        kind,
        quality,
        status: 'pending',
        progress: 0,
        addedAt: Date.now(),
      }));
    if (items.length) dispatch({ type: 'add', items });
    return items.length;
  }, []);

  const abortIfRunning = (id: string) => {
    if (worker.current?.id === id) worker.current.controller.abort();
  };

  const cancel = useCallback((id: string) => {
    abortIfRunning(id);
    dispatch({ type: 'patch', id, patch: { status: 'cancelled', speed: null } });
  }, []);

  const remove = useCallback((id: string) => {
    abortIfRunning(id);
    const it = stateRef.current.items.find((i) => i.id === id);
    if (it?.status === 'done') deleteLocalFile(it.localUri);
    dispatch({ type: 'remove', id });
  }, []);

  const setPaused = useCallback((paused: boolean) => {
    if (paused && worker.current) {
      const id = worker.current.id;
      worker.current.controller.abort();
      dispatch({ type: 'patch', id, patch: { status: 'pending', progress: 0, speed: null } });
    }
    dispatch({ type: 'pause', paused });
  }, []);

  const value = useMemo<Ctx>(() => {
    const items = state.items;
    return {
      ...state,
      current: items.find((i) => ACTIVE.includes(i.status)),
      pending: items.filter((i) => i.status === 'pending'),
      finished: items.filter((i) => i.status === 'failed' || i.status === 'cancelled'),
      library: items
        .filter((i) => i.status === 'done')
        .sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0)),
      enqueue,
      cancel,
      remove,
      retry: (id) => dispatch({ type: 'retry', id }),
      retryFailed: () => dispatch({ type: 'retryFailed' }),
      clearFinished: () => dispatch({ type: 'clearFinished' }),
      moveToTop: (id) => dispatch({ type: 'moveToTop', id }),
      setPaused,
      updateSettings: (patch) => dispatch({ type: 'settings', patch }),
      tap,
    };
  }, [state, enqueue, cancel, remove, setPaused, tap]);

  return <QueueContext.Provider value={value}>{children}</QueueContext.Provider>;
}

export function useQueue(): Ctx {
  const ctx = useContext(QueueContext);
  if (!ctx) throw new Error('useQueue must be used inside <QueueProvider>');
  return ctx;
}
