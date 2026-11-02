/** Turns raw yt-dlp errors into one calm sentence. */
export function friendlyError(raw: string | undefined, platform?: string): string {
  const msg = (raw || '').replace(/\x1b\[[0-9;]*m/g, '').trim();
  const l = msg.toLowerCase();
  if (!msg) return 'Download failed.';
  if (l.includes('sign in to confirm') || l.includes('not a bot'))
    return 'YouTube wants to check this phone. Wait a little, then retry.';
  if (l.includes('login required') || l.includes('log in') || l.includes('private') || l.includes('cookies'))
    return platform === 'instagram'
      ? 'Instagram needs you signed in. Go to Settings → Instagram.'
      : 'This video is private or needs a sign-in.';
  if (l.includes('rate') && l.includes('limit'))
    return platform === 'instagram'
      ? 'Instagram is limiting requests. Sign in under Settings, or retry later.'
      : 'Too many requests. Retry in a few minutes.';
  if (l.includes('unavailable') || l.includes('removed') || l.includes('does not exist') || l.includes('404'))
    return 'This video is no longer available.';
  if (l.includes('unsupported url')) return "This link isn't supported.";
  if (l.includes('no video formats') || l.includes('requested format'))
    return "Couldn't find a playable version. Try another quality, or update the engine in Settings.";
  if (l.includes('unable to download') || l.includes('network') || l.includes('timed out') || l.includes('resolve'))
    return 'Network problem. Check your connection and retry.';
  if (l.includes('no space')) return 'Your phone is out of storage.';
  return msg.length > 160 ? `${msg.slice(0, 157)}…` : msg;
}
