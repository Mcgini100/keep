import type { Platform } from './links';

export type Kind = 'video' | 'audio';
export type Quality = 'best' | '1080' | '720' | '480' | '360';

export type ItemStatus =
  | 'pending' // waiting its turn
  | 'downloading' // fetching streams from the platform
  | 'processing' // merging / converting on the phone
  | 'done'
  | 'failed'
  | 'cancelled';

export type Item = {
  id: string;
  url: string;
  platform: Platform;
  kind: Kind;
  quality: Quality;
  status: ItemStatus;
  progress: number; // 0..1
  speed?: number | null;
  preparing?: boolean;
  title?: string | null;
  thumbnail?: string | null;
  uploader?: string | null;
  duration?: number | null;
  error?: string | null;
  errorDetail?: string | null; // raw engine message, for "Copy details"
  localUri?: string | null;
  size?: number | null;
  savedToPhotos?: boolean;
  addedAt: number;
  finishedAt?: number;
};

export type Settings = {
  kind: Kind;
  quality: Quality;
  saveToPhotos: boolean;
  haptics: boolean;
  watchClipboard: boolean;
  lastEngineUpdate: number;
};

export type EngineState = {
  status: 'starting' | 'ready' | 'updating' | 'unavailable' | 'error';
  version: string | null;
  message?: string;
};

export const ACTIVE: ItemStatus[] = ['downloading', 'processing'];
