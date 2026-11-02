export type Platform = 'youtube' | 'instagram';

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

// Anything that looks like a link, with or without a scheme.
const URL_PATTERN =
  /(?:https?:\/\/)?(?:www\.|m\.|music\.)?(?:youtube\.com|youtu\.be|youtube-nocookie\.com|instagram\.com|instagr\.am)\/[^\s<>"'，、]+|https?:\/\/[^\s<>"']+/gi;

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
  return null;
}

function clean(raw: string): string {
  let url = raw.trim().replace(/[)\].,;!?]+$/, '');
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  return url;
}

/** Canonical key used to spot the same video pasted twice. */
export function linkKey(url: string): string {
  const yt =
    /(?:v=|youtu\.be\/|shorts\/|live\/|embed\/)([\w-]{11})/i.exec(url);
  if (yt) return `yt:${yt[1]}`;
  const ig = /instagram\.com\/(?:[\w.]+\/)?(?:p|reels?|tv)\/([\w-]+)/i.exec(url);
  if (ig) return `ig:${ig[1]}`;
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
