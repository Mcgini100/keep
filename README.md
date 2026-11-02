# Keep

A quiet, focused mobile app for saving YouTube and Instagram videos. Paste one link or a whole list — Keep lines them up and downloads them one after another.

Built with Expo (React Native) for iOS and Android, plus a small self-hosted download engine powered by [yt-dlp](https://github.com/yt-dlp/yt-dlp) and ffmpeg.

---

## Design

Keep follows the principles of Jony Ive's industrial design: as little design as possible, and every detail considered.

- **One thing at a time.** Each screen has a single primary action. Add links, watch the queue, find your files.
- **Restraint.** One accent colour, system typography, hairline structure. No gradients, no decoration.
- **Deference to content.** Thumbnails and titles carry the interface; chrome stays out of the way.
- **Honest materials.** Native controls, native share sheet, the real Photos library — nothing pretending to be something else.
- **Considered motion and touch.** Buttons give slightly when pressed, progress moves smoothly, and haptics confirm what just happened.
- **Light and dark.** Follows the system appearance automatically.

## Features

- Paste many links at once — one per line, comma separated, or mixed into a message. Duplicates and unsupported links are filtered out before you commit.
- Sequential queue — one download at a time, in the order you added them.
- Pause / resume the whole queue, cancel the current item, move any item to the top, remove items.
- Retry a single failed download or all of them at once.
- Video or audio-only (M4A), with Best / 1080p / 720p / 480p / 360p quality.
- Live progress: fetching speed and percentage, then transfer to the phone.
- Videos saved automatically to a **Keep** album in Photos (optional).
- Library of everything you've kept, filterable by video or audio; tap to share, long press to delete.
- Clipboard detection — open Keep with a link copied and it offers to add it.
- Queue, library and settings survive app restarts; interrupted downloads restart automatically.
- Optional access key so only your phone can use your engine.

Supports YouTube (videos, Shorts, Music, live replays) and Instagram (posts, reels, IGTV). Private Instagram content works if you give the engine a cookies file.

## How it works

```
 Phone (Keep app)                     Your server (Keep engine)
 ────────────────                     ─────────────────────────
 paste links ──► queue
 next item  ──── POST /api/jobs ────► yt-dlp downloads + ffmpeg merges
 progress   ◄─── GET  /api/jobs/:id ─ 
 save file  ◄─── GET  /api/jobs/:id/file
 Photos / Library   DELETE /api/jobs/:id ► files cleaned up
```

YouTube and Instagram can't be downloaded reliably from inside a phone app — the formats change constantly and need ffmpeg to merge. So the heavy lifting runs on a small engine you host (a VPS, a home server, or your laptop on the same Wi-Fi), and the phone just receives a clean MP4/M4A.

## Repository layout

```
app/      Expo app (TypeScript)
  App.tsx              tab shell, clipboard offer
  src/theme.ts         colours, spacing, type scale
  src/lib/links.ts     link extraction + platform detection
  src/lib/store.tsx    queue state + sequential worker
  src/lib/api.ts       engine client
  src/screens/         Add, Queue, Library, Settings
  src/components/      small set of shared UI pieces
server/   Download engine (FastAPI + yt-dlp)
  keep_server/main.py  jobs API
  keep_server/links.py link validation
  tests/               pytest suite
```

## Getting started

### 1. Run the engine

With Docker (recommended):

```bash
cd server
KEEP_API_KEY=$(openssl rand -hex 24) docker compose up -d --build
echo $KEEP_API_KEY   # you'll paste this into the app
```

Without Docker (needs Python 3.11+ and ffmpeg on your PATH):

```bash
cd server
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
KEEP_API_KEY=your-secret uvicorn keep_server.main:app --host 0.0.0.0 --port 8000
```

Check it: `curl http://localhost:8000/health`

| Variable | Default | Purpose |
| --- | --- | --- |
| `KEEP_API_KEY` | *(empty)* | If set, the app must send the same key. Strongly recommended on a public server. |
| `KEEP_FILE_TTL` | `3600` | Seconds before finished files are deleted from the server. |
| `KEEP_MAX_CONCURRENT` | `2` | Jobs the engine runs in parallel (the app itself sends one at a time). |
| `KEEP_COOKIES_FILE` | *(empty)* | Netscape-format cookies file for private Instagram posts. |
| `KEEP_DOWNLOAD_DIR` | `./downloads` | Where temporary files are written. |

For use outside your home network, put the engine behind HTTPS (e.g. Caddy or nginx with Let's Encrypt).

### 2. Run the app

```bash
cd app
npm install
npx expo start
```

The app uses native modules (Photos, file system), so run it as a development build:

```bash
npx expo run:android      # or: npx expo run:ios
# or in the cloud:
npx eas-cli@latest build --profile development --platform android
```

Then open **Settings** in the app, enter the engine address (e.g. `http://192.168.1.20:8000` or `https://keep.yourdomain.com`) and the access key, and tap **Test connection**.

### 3. Tests

```bash
cd server && pip install pytest httpx && pytest -q
cd app && npx tsc --noEmit
```

## Keeping it working

YouTube and Instagram change often. When downloads start failing, update yt-dlp on the engine — the Docker image does this automatically on every restart:

```bash
docker compose restart          # or: pip install -U yt-dlp
```

## Responsible use

Only download content you own, content that's openly licensed, or content you have permission to save. Respect creators and the platforms' terms of service.

## License

MIT © Musawenkosi Mpofu
