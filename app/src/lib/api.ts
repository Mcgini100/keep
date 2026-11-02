import type { Kind, Quality, Settings } from './types';

export type RemoteJob = {
  id: string;
  status: 'queued' | 'downloading' | 'processing' | 'ready' | 'error' | 'cancelled';
  progress: number;
  speed: number | null;
  eta: number | null;
  title: string | null;
  thumbnail: string | null;
  uploader: string | null;
  duration: number | null;
  filename: string | null;
  filesize: number | null;
  error: string | null;
};

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function base(settings: Settings): string {
  const url = settings.serverUrl.trim().replace(/\/+$/, '');
  if (!url) throw new ApiError('Add your download engine address in Settings.', 0);
  return /^https?:\/\//i.test(url) ? url : `http://${url}`;
}

export function authHeaders(settings: Settings): Record<string, string> {
  return settings.apiKey ? { 'X-Keep-Key': settings.apiKey } : {};
}

async function request<T>(
  settings: Settings,
  path: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? 20000);
  const outer = init.signal;
  const onAbort = () => controller.abort();
  outer?.addEventListener('abort', onAbort);
  try {
    const res = await fetch(`${base(settings)}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(settings),
        ...(init.headers as Record<string, string> | undefined),
      },
    });
    const text = await res.text();
    const body = text ? JSON.parse(text) : {};
    if (!res.ok) {
      const detail = typeof body?.detail === 'string' ? body.detail : `Request failed (${res.status}).`;
      throw new ApiError(detail, res.status);
    }
    return body as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (outer?.aborted) throw e;
    if ((e as Error)?.name === 'AbortError') throw new ApiError("The engine didn't respond in time.", 0);
    throw new ApiError("Can't reach the download engine. Check the address in Settings.", 0);
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener('abort', onAbort);
  }
}

export const api = {
  health: (s: Settings) =>
    request<{ ok: boolean; yt_dlp: string; ffmpeg: boolean; auth: boolean }>(s, '/health', { timeoutMs: 8000 }),

  createJob: (s: Settings, url: string, kind: Kind, quality: Quality, signal?: AbortSignal) =>
    request<RemoteJob>(s, '/api/jobs', {
      method: 'POST',
      body: JSON.stringify({ url, kind, quality }),
      signal,
    }),

  job: (s: Settings, id: string, signal?: AbortSignal) =>
    request<RemoteJob>(s, `/api/jobs/${id}`, { signal }),

  fileUrl: (s: Settings, id: string) => `${base(s)}/api/jobs/${id}/file`,

  deleteJob: (s: Settings, id: string) =>
    request<{ ok: boolean }>(s, `/api/jobs/${id}`, { method: 'DELETE', timeoutMs: 8000 }).catch(() => undefined),
};
