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

export type Service = 'youtube' | 'instagram';

const COOKIE_DOMAIN: Record<Service, string> = { youtube: '.youtube.com', instagram: '.instagram.com' };

type NativeEngine = {
  prepare(): Promise<{ version: string | null }>;
  update(): Promise<{ updated: boolean; version: string | null }>;
  download(
    id: string,
    url: string,
    kind: string,
    quality: string,
    cookies: string | null,
    cookieDomain: string | null,
  ): Promise<DownloadResult>;
  cancel(id: string): boolean;
  sessionCookies(service: Service): Promise<string | null>;
  signOut(service: Service): Promise<boolean>;
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
  /** Downloads one link, using the signed-in session for that service if there is one. */
  download: async (id: string, url: string, kind: string, quality: string, service: Service) => {
    const cookies = await Engine.sessionCookies(service);
    return engine().download(id, url, kind, quality, cookies, COOKIE_DOMAIN[service]);
  },
  cancel: (id: string) => (native ? native.cancel(id) : false),
  sessionCookies: (service: Service) =>
    native ? native.sessionCookies(service).catch(() => null) : Promise.resolve(null),
  signOut: (service: Service) => (native ? native.signOut(service) : Promise.resolve(false)),
  onProgress: (listener: (e: ProgressEvent) => void): EventSubscription | null =>
    native ? native.addListener('onProgress', listener) : null,
};
