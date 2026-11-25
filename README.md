# Keep

A quiet, focused Android app for saving YouTube, Instagram and X (Twitter) videos. Paste one link or a whole list, and Keep downloads several at once, entirely on your phone. No server, no account, no computer needed.

## ⬇️ Download

**[Download Keep for Android (keep.apk)](https://github.com/Mcgini100/keep/releases/latest/download/keep.apk)**

1. Tap the link above on your phone.
2. Open the downloaded `keep.apk`.
3. If Android asks, allow your browser to **install unknown apps**, then tap **Install**.

New versions install straight over the old one, and your library is kept. All builds are listed on the [Releases page](https://github.com/Mcgini100/keep/releases).

> Works on 64-bit (arm64) Android phones running Android 7.0 or newer, which covers almost every phone made since 2017. The first launch takes a few seconds while the download engine unpacks.

---

## Design

Keep follows Jony Ive's industrial design principles: as little design as possible, with every detail considered.

- **One thing at a time.** Each screen has a single job: add links, watch the queue, find your files.
- **Restraint.** One accent colour, system type, hairline structure. No gradients, no decoration.
- **Deference to content.** Thumbnails and titles carry the interface, and the chrome stays out of the way.
- **Honest materials.** Native controls, the native share sheet, and your real Gallery.
- **Considered motion and touch.** Buttons give slightly when pressed, progress moves smoothly, and haptics confirm what just happened.
- **Light and dark.** Follows your phone's appearance.

## Features

- **Paste many links at once.** Put them one per line, separate them with commas, or leave them inside a message. Duplicates and unsupported links are filtered out before you start.
- **Concurrent queue.** Up to five downloads run side by side (three by default), started in the order you added them. Choose how many under **Settings → Downloads at once**; set it to 1 for the old one-at-a-time behaviour.
- **Queue control.** Pause and resume everything, cancel any running item, move any item to the top, or remove items.
- **Retry.** Retry one failed download, or all of them at once.
- **Formats.** Video (MP4, H.264 for universal playback) or audio only (M4A), at Best, 1080p, 720p, 480p or 360p.
- **Live progress.** Shows speed and percentage, then the merge step.
- **Gallery.** Videos are saved to a **Keep** album in your Gallery. You can turn this off.
- **Library.** Everything you've kept, filtered by video or audio. Tap to share, long press to delete.
- **Clipboard.** Open Keep with a link copied and it offers to add it.
- **YouTube, Instagram and X sign-in (optional).** YouTube now often asks to *confirm you're not a bot*, and Instagram blocks most signed-out downloads. X needs a session for protected accounts and posts marked sensitive. Sign in once under **Settings → Accounts**, on the real Google, Instagram or X page inside the app, and downloads use your session. Keep stores only the session, never your password. A spare Google account is safest.
- **Error details.** Tap a failed download to see exactly what went wrong, and copy it to share.
- **Self-updating engine.** yt-dlp updates itself once a day, or whenever you tap **Update** in Settings, so downloads keep working when YouTube, Instagram or X change.
- **Survives restarts.** The queue, library and settings are saved. Interrupted downloads start again automatically.

Supported links: YouTube videos, Shorts, Music and live replays; Instagram posts, reels and IGTV; and X / Twitter posts with video or GIFs (`x.com` or `twitter.com`, including `/video/2` for a post's second video).

## How it works

Keep runs [yt-dlp](https://github.com/yt-dlp/yt-dlp) on the phone itself through [youtubedl-android](https://github.com/yausername/youtubedl-android). That library bundles Python, ffmpeg and the QuickJS JavaScript runtime that YouTube now requires. A small native module (`app/modules/keep-engine`) connects it to the React Native interface.

```
paste links ─► queue ─► engine pool (N × yt-dlp + ffmpeg, on-device) ─► Keep library ─► Gallery album
```

## Building

You never need to build it yourself. Every push to `main` makes GitHub Actions build a fresh APK and publish it as the latest release, so the download link above always points to the newest build.

To build locally (needs Node 22, JDK 17 and the Android SDK):

```bash
cd app
npm install
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease
# → app/android/app/build/outputs/apk/release/app-release.apk
```

## Project layout

```
app/
  App.tsx                    tab shell, clipboard offer
  modules/keep-engine/       native Android module wrapping yt-dlp + ffmpeg
  src/theme.ts               colours, spacing, type scale
  src/lib/links.ts           link extraction and platform detection
  src/lib/store.tsx          queue state and concurrent worker pool
  src/lib/scheduler.ts       picks which pending items start next
  src/screens/               Add, Queue, Library, Settings, Instagram sign-in
  src/components/            shared UI pieces
.github/workflows/android.yml  builds and publishes the APK
```

## Responsible use

Only download content you own, content that's openly licensed, or content you have permission to save. Respect creators and each platform's terms.

## License

GPL-3.0 © Musawenkosi Mpofu. Keep is built on youtubedl-android and yt-dlp, and is released under the same copyleft licence.
