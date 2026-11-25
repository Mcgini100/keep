export type Platform = 'youtube' | 'instagram' | 'x';

export type ParsedLink = {
  url: string;
  platform: Platform | null;
};

const YT_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtu.be',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);
const IG_HOSTS = new Set(['instagram.com', 'www.instagram.com', 'm.instagram.com', 'instagr.am']);
const IG_PATH = /^\/(?:[\w.]+\/)?(p|reel|reels|tv|stories)\/[\w\-.]+/i;
const X_HOSTS = new Set([
  'x.com',
  'www.x.com',
  'mobile.x.com',
  'twitter.com',
  'www.twitter.com',
  'mobile.twitter.com',
]);
// /<user>/status/<id>, /i/status/<id>, /i/web/status/<id>, optionally /video/1 or /photo/1.
const X_PATH = /^\/(?:[\w]{1,15}|i(?:\/web)?)\/status(?:es)?\/(\d+)/i;

// Anything that looks like a link, with or without a scheme.
// The lookbehind stops "netflix.com/…" from being read as "x.com/…".
const URL_PATTERN =
  /(?<![\w.-])(?:https?:\/\/)?(?:www\.|m\.|music\.|mobile\.)?(?:youtube\.com|youtu\.be|youtube-nocookie\.com|instagram\.com|instagr\.am|twitter\.com|x\.com)\/[^\s<>"'，、]+|https?:\/\/[^\s<>"']+/gi;

function hostAndPath(url: string): { host: string; path: string } | null {
  const m = /^https?:\/\/([^/?#]+)([^?#]*)/i.exec(url);
  if (!m) return null;
  return { host: m[1].toLowerCase(), path: m[2] || '/' };
}

export function detectPlatform(url: string): Platform | null {
  const hp = hostAndPath(url);
  if (!hp) return null;
  if (YT_HOSTS.has(hp.host)) {
    if (hp.host.endsWith('youtu.be')) return hp.path.length > 1 ? 'youtube' : null;
    if (/^\/(watch|shorts\/|live\/|embed\/|v\/)/.test(hp.path)) return 'youtube';
    return null;
  }
  if (IG_HOSTS.has(hp.host)) return IG_PATH.test(hp.path) ? 'instagram' : null;
  if (X_HOSTS.has(hp.host)) return X_PATH.test(hp.path) ? 'x' : null;
  return null;
}

function clean(raw: string): string {
  let url = raw.trim().replace(/[)\].,;!?]+$/, '');
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  // yt-dlp's Instagram extractor expects the canonical host. Keep accepts
  // mobile and short-domain shares, so normalize them before queueing.
  url = url.replace(/^https?:\/\/(?:m\.instagram\.com|instagr\.am)(?=\/|[?#]|$)/i, 'https://www.instagram.com');
  // Twitter and X share one extractor; send every variant to x.com.
  url = url.replace(/^https?:\/\/(?:(?:www|mobile)\.)?(?:twitter|x)\.com(?=\/|[?#]|$)/i, 'https://x.com');
  return url;
}

/** Canonical key used to spot the same video pasted twice. */
export function linkKey(url: string): string {
  const yt =
    /(?:v=|youtu\.be\/|shorts\/|live\/|embed\/)([\w-]{11})/i.exec(url);
  if (yt) return `yt:${yt[1]}`;
  const ig = /instagram\.com\/(?:[\w.]+\/)?(?:p|reels?|tv)\/([\w-]+)/i.exec(url);
  if (ig) return `ig:${ig[1]}`;
  // A post can hold several videos; /video/2 is a different file from /video/1.
  const x = /(?:twitter|x)\.com\/(?:[\w]{1,15}|i(?:\/web)?)\/status(?:es)?\/(\d+)(?:\/(?:video|photo)\/(\d+))?/i.exec(url);
  if (x) return x[2] && x[2] !== '1' ? `x:${x[1]}/${x[2]}` : `x:${x[1]}`;
  return url.toLowerCase();
}

/** Pull every link out of free text — one per line, comma separated, or mixed with prose. */
export function extractLinks(text: string): ParsedLink[] {
  const matches = text.match(URL_PATTERN) ?? [];
  const seen = new Set<string>();
  const out: ParsedLink[] = [];
  for (const raw of matches) {
    const url = clean(raw);
    const key = linkKey(url);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ url, platform: detectPlatform(url) });
  }
  return out;
}

export function prettyUrl(url: string): string {
  return url.replace(/^https?:\/\/(www\.|m\.)?/i, '').replace(/\/$/, '');
}
