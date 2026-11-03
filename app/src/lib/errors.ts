/** Turns raw yt-dlp errors into one calm sentence. */
export function friendlyError(raw: string | undefined, platform?: string): string {
  const msg = (raw || '').replace(/\x1b\[[0-9;]*m/g, '').trim();
  const l = msg.split('\n').filter((line) => !line.includes('[debug]')).join('\n').toLowerCase();
  if (!msg) return 'Download failed.';
  if (l.includes('no supported javascript runtime') || l.includes('challenge solving failed') || l.includes('n challenge'))
    return 'YouTube’s player challenge failed. Update the engine, then retry. Copy error details if it persists.';
  if (l.includes('429') || (l.includes('rate') && l.includes('limit')))
    return 'The service is limiting requests. Wait before retrying; repeated sign-ins may not help.';
  if (l.includes('403') || l.includes('po token') || l.includes('po_token'))
    return 'The service rejected the media request. Signing in alone may not fix this. Update the engine and check error details.';
  if (l.includes('checkpoint') || l.includes('challenge_required'))
    return 'Open Instagram and complete its account verification, then sign in again in Keep.';
  if (l.includes('sign in to confirm') || l.includes('not a bot'))
    return 'YouTube rejected this session or network. If already signed in, update the engine and copy the error details.';
  if (l.includes('age') && (l.includes('confirm your age') || l.includes('age-restricted') || l.includes('inappropriate')))
    return 'This video is age-restricted. Sign in to YouTube in Settings, then retry.';
  if (l.includes('login required') || l.includes('log in') || l.includes('private') || l.includes('cookies'))
    return platform === 'instagram'
      ? 'Instagram needs you signed in. Go to Settings → Instagram → Sign in.'
      : 'This video is private or needs a sign-in. Try Settings → YouTube → Sign in.';
  if (l.includes('unavailable') || l.includes('removed') || l.includes('does not exist') || l.includes('404'))
    return 'This video is no longer available.';
  if (l.includes('unsupported url')) return "This link isn't supported.";
  if (l.includes('no video formats') || l.includes('requested format'))
    return "Couldn't find a playable version. Try another quality, or update the engine in Settings.";
  if (l.includes('unable to download') || l.includes('network') || l.includes('timed out') || l.includes('resolve'))
    return 'Network problem. Check your connection and retry.';
  if (l.includes('no space')) return 'Your phone is out of storage.';
  const summary = msg.split('\n').reverse().find((line) => line.includes('ERROR:'))?.split('ERROR:').slice(1).join('ERROR:').trim() || msg;
  return summary.length > 160 ? `${summary.slice(0, 157)}…` : summary;
}
