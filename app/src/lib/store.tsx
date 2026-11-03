import AsyncStorage from '@react-native-async-storage/async-storage';
import { File } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { Album, Asset, requestPermissionsAsync } from 'expo-media-library';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { Platform as RNPlatform } from 'react-native';

import { Engine, engineAvailable } from '../../modules/keep-engine';
import { friendlyError } from './errors';
import type { ParsedLink } from './links';
import { ACTIVE, EngineState, Item, Kind, Quality, Settings } from './types';

// --------------------------------------------------------------------------- //
// State
// --------------------------------------------------------------------------- //

const STORAGE_KEY = 'keep/state/v2';
const ALBUM = 'Keep';
const DAY = 24 * 60 * 60 * 1000;

export const defaultSettings: Settings = {
  kind: 'video',
  quality: 'best',
  saveToPhotos: true,
  haptics: true,
  watchClipboard: RNPlatform.OS === 'android',
  lastEngineUpdate: 0,
};

type State = {
  hydrated: boolean;
  paused: boolean;
  items: Item[];
  settings: Settings;
  engine: EngineState;
};

type Action =
  | { type: 'hydrate'; state: Partial<State> }
  | { type: 'add'; items: Item[] }
  | { type: 'patch'; id: string; patch: Partial<Item> }
  | { type: 'progress'; id: string; patch: Partial<Item> }
  | { type: 'remove'; id: string }
  | { type: 'retry'; id: string }
  | { type: 'retryFailed' }
  | { type: 'clearFinished' }
  | { type: 'moveToTop'; id: string }
  | { type: 'pause'; paused: boolean }
  | { type: 'settings'; patch: Partial<Settings> }
  | { type: 'engine'; engine: Partial<EngineState> };

const initial: State = {
  hydrated: false,
  paused: false,
  items: [],
  settings: defaultSettings,
  engine: { status: engineAvailable ? 'starting' : 'unavailable', version: null },
};

const reset = (it: Item): Item => ({
  ...it,
  status: 'pending',
  progress: 0,
  error: null,
  errorDetail: null,
  speed: null,
  preparing: false,
});

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'hydrate':
      return { ...state, ...action.state, hydrated: true };
    case 'add':
      return { ...state, items: [...state.items, ...action.items] };
    case 'patch':
      return { ...state, items: state.items.map((it) => (it.id === action.id ? { ...it, ...action.patch } : it)) };
    case 'progress':
      // Late events from a cancelled job must not bring it back to life.
      return {
        ...state,
        items: state.items.map((it) =>
          it.id === action.id && ACTIVE.includes(it.status) ? { ...it, ...action.patch } : it,
        ),
      };
    case 'remove':
      return { ...state, items: state.items.filter((it) => it.id !== action.id) };
    case 'retry':
      return { ...state, items: state.items.map((it) => (it.id === action.id ? reset(it) : it)) };
    case 'retryFailed':
      return {
        ...state,
        items: state.items.map((it) => (it.status === 'failed' || it.status === 'cancelled' ? reset(it) : it)),
      };
    case 'clearFinished':
      return { ...state, items: state.items.filter((it) => it.status !== 'failed' && it.status !== 'cancelled') };
    case 'moveToTop': {
      const target = state.items.find((it) => it.id === action.id);
      if (!target) return state;
      return { ...state, items: [target, ...state.items.filter((it) => it.id !== action.id)] };
    }
    case 'pause':
      return { ...state, paused: action.paused };
    case 'settings':
      return { ...state, settings: { ...state.settings, ...action.patch } };
    case 'engine':
      return { ...state, engine: { ...state.engine, ...action.engine } };
  }
}

// --------------------------------------------------------------------------- //
// Helpers
// --------------------------------------------------------------------------- //

const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

async function saveToPhotos(uri: string): Promise<boolean> {
  if (RNPlatform.OS === 'android' && Number(RNPlatform.Version) >= 29) {
    return Engine.saveToGallery(uri);
  }
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
    // Already gone.
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
  updateEngine: () => Promise<void>;
  retryEngine: () => Promise<void>;
  saveItemToGallery: (item: Item) => Promise<void>;
  tap: (style?: 'light' | 'success' | 'error') => void;
};

const QueueContext = createContext<Ctx | null>(null);

export function QueueProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);
  const stateRef = useRef(state);
  stateRef.current = state;
  const running = useRef<string | null>(null);

  // ---- persistence -------------------------------------------------------- //
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) return dispatch({ type: 'hydrate', state: {} });
        const saved = JSON.parse(raw) as Partial<State>;
        // Anything mid-flight when the app closed starts again from the top.
        const items = (saved.items ?? []).map((it) => (ACTIVE.includes(it.status) ? reset(it) : it));
        dispatch({
          type: 'hydrate',
          state: { items, paused: saved.paused ?? false, settings: { ...defaultSettings, ...(saved.settings ?? {}) } },
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

  // ---- engine lifecycle --------------------------------------------------- //
  const updateEngine = useCallback(async () => {
    if (!engineAvailable) return;
    dispatch({ type: 'engine', engine: { status: 'updating', message: undefined } });
    try {
      const r = await Engine.update();
      dispatch({ type: 'engine', engine: { status: 'ready', version: r.version, message: r.updated ? 'Updated' : 'Up to date' } });
      dispatch({ type: 'settings', patch: { lastEngineUpdate: Date.now() } });
    } catch (e) {
      dispatch({ type: 'engine', engine: { status: 'ready', message: "Couldn't update. Check your connection." } });
    }
  }, []);

  const retryEngine = useCallback(async () => {
    if (!engineAvailable) return;
    dispatch({ type: 'engine', engine: { status: 'starting', message: undefined } });
    try {
      const r = await Engine.prepare();
      dispatch({ type: 'engine', engine: { version: r.version } });
      if (Date.now() - stateRef.current.settings.lastEngineUpdate > DAY) await updateEngine();
      else dispatch({ type: 'engine', engine: { status: 'ready' } });
    } catch (e) {
      dispatch({ type: 'engine', engine: { status: 'error', message: (e as Error).message } });
    }
  }, [updateEngine]);

  useEffect(() => {
    if (state.hydrated && engineAvailable) retryEngine();
  }, [state.hydrated, retryEngine]);

  useEffect(() => {
    const sub = Engine.onProgress((e) => {
      const patch: Partial<Item> = {
        status: e.phase === 'processing' ? 'processing' : 'downloading',
        preparing: e.phase === 'preparing',
        progress: e.progress,
      };
      if (e.speed !== undefined) patch.speed = e.speed;
      if (e.title) patch.title = e.title;
      if (e.thumbnail) patch.thumbnail = e.thumbnail;
      if (e.uploader) patch.uploader = e.uploader;
      if (e.duration) patch.duration = e.duration;
      dispatch({ type: 'progress', id: e.id, patch });
    });
    return () => sub?.remove();
  }, []);

  // ---- the sequential worker --------------------------------------------- //
  const process = useCallback(
    async (item: Item) => {
      running.current = item.id;
      const patch = (p: Partial<Item>) => dispatch({ type: 'patch', id: item.id, patch: p });
      patch({ status: 'downloading', progress: 0, error: null, preparing: true });

      try {
        const res = await Engine.download(item.id, item.url, item.kind, item.quality, item.platform);

        // Still wanted? (It may have been cancelled in the last instant.)
        const now = stateRef.current.items.find((i) => i.id === item.id);
        if (!now || !ACTIVE.includes(now.status)) {
          deleteLocalFile(res.uri);
          return;
        }

        let savedToPhotos = false;
        if (item.kind === 'video' && stateRef.current.settings.saveToPhotos) {
          try {
            savedToPhotos = await saveToPhotos(res.uri);
          } catch {
            savedToPhotos = false;
          }
        }

        patch({
          status: 'done',
          progress: 1,
          speed: null,
          preparing: false,
          localUri: res.uri,
          size: res.size,
          title: res.title ?? now.title,
          thumbnail: res.thumbnail ?? now.thumbnail,
          uploader: res.uploader ?? now.uploader,
          duration: res.duration ?? now.duration,
          savedToPhotos,
          finishedAt: Date.now(),
        });
        tap('success');
      } catch (e) {
        const err = e as Error & { code?: string };
        if (err.code === 'ERR_CANCELLED') return; // cancel / pause already set the status
        dispatch({
          type: 'progress',
          id: item.id,
          patch: {
            status: 'failed',
            error: friendlyError(err.message, item.platform),
            errorDetail: err.message || null,
            speed: null,
            preparing: false,
          },
        });
        tap('error');
      } finally {
        if (running.current === item.id) running.current = null;
        // Nudge the effect below to look for the next item.
        dispatch({ type: 'patch', id: '__tick__', patch: {} });
      }
    },
    [tap],
  );

  useEffect(() => {
    if (!state.hydrated || state.paused || running.current || !engineAvailable) return;
    if (state.engine.status !== 'ready') return;
    const next = state.items.find((it) => it.status === 'pending');
    if (next) process(next);
  }, [state.hydrated, state.paused, state.items, state.engine.status, process]);

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

  const saveItemToGallery = useCallback(async (item: Item) => {
    if (!item.localUri || item.kind !== 'video') throw new Error('Video file is unavailable.');
    if (!await saveToPhotos(item.localUri)) throw new Error('Gallery access was not granted.');
    dispatch({ type: 'patch', id: item.id, patch: { savedToPhotos: true } });
  }, []);

  const cancel = useCallback((id: string) => {
    dispatch({ type: 'patch', id, patch: { status: 'cancelled', speed: null, preparing: false } });
    Engine.cancel(id);
  }, []);

  const remove = useCallback((id: string) => {
    const it = stateRef.current.items.find((i) => i.id === id);
    if (it && ACTIVE.includes(it.status)) Engine.cancel(id);
    if (it?.status === 'done') deleteLocalFile(it.localUri);
    dispatch({ type: 'remove', id });
  }, []);

  const setPaused = useCallback((paused: boolean) => {
    const id = running.current;
    if (paused && id) {
      dispatch({ type: 'patch', id, patch: { status: 'pending', progress: 0, speed: null, preparing: false } });
      Engine.cancel(id);
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
      library: items.filter((i) => i.status === 'done').sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0)),
      enqueue,
      cancel,
      remove,
      retry: (id) => dispatch({ type: 'retry', id }),
      retryFailed: () => dispatch({ type: 'retryFailed' }),
      clearFinished: () => dispatch({ type: 'clearFinished' }),
      moveToTop: (id) => dispatch({ type: 'moveToTop', id }),
      setPaused,
      updateSettings: (patch) => dispatch({ type: 'settings', patch }),
      updateEngine,
      retryEngine,
      saveItemToGallery,
      tap,
    };
  }, [state, enqueue, cancel, remove, setPaused, updateEngine, retryEngine, saveItemToGallery, tap]);

  return <QueueContext.Provider value={value}>{children}</QueueContext.Provider>;
}

export function useQueue(): Ctx {
  const ctx = useContext(QueueContext);
  if (!ctx) throw new Error('useQueue must be used inside <QueueProvider>');
  return ctx;
}
