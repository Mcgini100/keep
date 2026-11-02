import type { Platform } from './links';

export type Kind = 'video' | 'audio';
export type Quality = 'best' | '1080' | '720' | '480' | '360';

export type ItemStatus =
  | 'pending' // waiting its turn
  | 'fetching' // engine is downloading from the platform
  | 'saving' // phone is receiving the file
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
  progress: number; // 0..1 across both phases
  speed?: number | null;
  title?: string | null;
  thumbnail?: string | null;
  uploader?: string | null;
  duration?: number | null;
  error?: string | null;
  localUri?: string | null;
  size?: number | null;
  savedToPhotos?: boolean;
  addedAt: number;
  finishedAt?: number;
};

export type Settings = {
  serverUrl: string;
  apiKey: string;
  kind: Kind;
  quality: Quality;
  saveToPhotos: boolean;
  haptics: boolean;
  watchClipboard: boolean;
};

export const ACTIVE: ItemStatus[] = ['fetching', 'saving'];
