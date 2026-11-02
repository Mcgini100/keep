import { requireOptionalNativeModule, type EventSubscription } from 'expo-modules-core';

export type EnginePhase = 'preparing' | 'downloading' | 'processing';

export type ProgressEvent = {
  id: string;
  phase: EnginePhase;
  progress: number; // 0..1
  speed?: number | null; // bytes / second
  eta?: number | null; // seconds
  title?: string | null;
  thumbnail?: string | null;
  uploader?: string | null;
  duration?: number | null;
};

export type DownloadResult = {
  uri: string;
  size: number;
  title?: string | null;
  thumbnail?: string | null;
  uploader?: string | null;
  duration?: number | null;
};

type NativeEngine = {
  prepare(): Promise<{ version: string | null }>;
  update(): Promise<{ updated: boolean; version: string | null }>;
  download(id: string, url: string, kind: string, quality: string, cookies: string | null): Promise<DownloadResult>;
  cancel(id: string): boolean;
  instagramCookies(): Promise<string | null>;
  signOutInstagram(): Promise<boolean>;
  addListener(event: 'onProgress', listener: (e: ProgressEvent) => void): EventSubscription;
};

const native = requireOptionalNativeModule<NativeEngine>('KeepEngine');

/** False on platforms without the on-device engine (iOS, web, Expo Go). */
export const engineAvailable = native != null;

function engine(): NativeEngine {
  if (!native) throw new Error('The download engine runs on Android. Install the Keep APK.');
  return native;
}

export const Engine = {
  prepare: () => engine().prepare(),
  update: () => engine().update(),
  download: (id: string, url: string, kind: string, quality: string, cookies: string | null) =>
    engine().download(id, url, kind, quality, cookies),
  cancel: (id: string) => (native ? native.cancel(id) : false),
  instagramCookies: () => (native ? native.instagramCookies() : Promise.resolve(null)),
  signOutInstagram: () => (native ? native.signOutInstagram() : Promise.resolve(false)),
  onProgress: (listener: (e: ProgressEvent) => void): EventSubscription | null =>
    native ? native.addListener('onProgress', listener) : null,
};
