"""Link recognition shared by the API and the tests."""

from __future__ import annotations

import re
from typing import Optional
from urllib.parse import urlparse

_YOUTUBE_HOSTS = {
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "music.youtube.com",
    "youtu.be",
    "www.youtu.be",
    "youtube-nocookie.com",
    "www.youtube-nocookie.com",
}
_INSTAGRAM_HOSTS = {"instagram.com", "www.instagram.com", "m.instagram.com", "instagr.am"}

_IG_PATH = re.compile(r"^/(?:[\w.]+/)?(p|reel|reels|tv|stories)/[\w\-.]+", re.IGNORECASE)


def normalise_url(raw: str) -> str:
    url = raw.strip().strip("<>\"'")
    if not re.match(r"^https?://", url, re.IGNORECASE):
        url = "https://" + url
    return url


def detect_platform(url: str) -> Optional[str]:
    try:
        parsed = urlparse(url)
    except ValueError:
        return None
    host = (parsed.hostname or "").lower()
    if host in _YOUTUBE_HOSTS:
        if host.endswith("youtu.be"):
            return "youtube" if len(parsed.path) > 1 else None
        if parsed.path.startswith(("/watch", "/shorts/", "/live/", "/embed/", "/v/")):
            return "youtube"
        return None
    if host in _INSTAGRAM_HOSTS:
        return "instagram" if _IG_PATH.match(parsed.path) else None
    return None
