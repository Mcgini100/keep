# Download reliability investigation

This patch is **not yet a verified fix for the reported `gp0` failure**.
The reported text does not establish its cause. Instagram was not tested by
the reporter. No real account cookies were requested or used during development.

## Confirmed code issues addressed

- The queue previously ran while the engine was updating or in an error state.
  It now waits for `ready`, including the initial automatic update.
- Every video was extracted twice. The download now uses `--load-info-json`
  from the first extraction, retaining media URLs and request headers.
- The Android wrapper disables yt-dlp caching unless a cache directory is
  explicitly set. Keep now supplies an app-private cache for EJS and other
  extractor caches.
- Error handling previously kept only a short final error line. It now retains
  bounded diagnostics, exception causes and engine version, removes URLs and
  common credential values, and distinguishes several actionable failure types.
- Account detection now matches nonempty cookie names rather than substrings.
  Cookie export uses session expiry rather than inventing a one-year lifetime.
  Account copy describes a saved session rather than promising a valid login.
- The downloaded file is taken from yt-dlp's `after_move:filepath` output rather
  than guessing from the largest file in the job directory.
- The engine-check workflow now reuses metadata, fails when a download fails,
  and passes its supplied URL as environment data rather than shell source.
- Pull requests build test APK artifacts; only main builds publish releases.

## Validation performed

- `cd app && npm test`: seven error-classification regression tests.
- `cd app && npx tsc --noEmit`: TypeScript validation.
- `python -m unittest discover -s tests -v` with yt-dlp available: a local HTTP
  fixture verifies metadata reuse, request-header preservation, media bytes,
  final-path reporting, and no second webpage extraction. This is not a media
  playback or platform compatibility test.
- Android native compilation and real-device downloads remain unverified:
  this environment has no Android SDK/device. Attempts to access YouTube
  encountered an HTTPS certificate-chain failure in this environment. No
  certificate verification was disabled in the app.

## Next verification

1. Open a pull request containing this patch. Its Build APK workflow produces
   the `keep-apk` artifact without publishing a release. Install that test APK.
2. Wait for the engine update to finish in Settings.
3. Try a short public YouTube video you have permission to save, signed out and
   signed in. Also try an Instagram reel you have permission to save.
4. If a download fails, tap it and copy its full error details. Record the engine
   version, Android version, affected link and whether it fails on Wi-Fi, mobile
   data, or both. Never share passwords or raw cookies.
5. Verify video/audio output, Gallery saving, cancellation and queue restart.

A saved browser session does not guarantee that either service will accept
media requests. If diagnostics show a YouTube Proof-of-Origin token failure,
that needs a properly integrated per-request token provider; this patch does
not include one. It does not bypass account permissions, private-video access,
or paid-content restrictions.
