# Atlas 2.2.8 — final Gallery update

Includes the Places redesign, adjustable preview quality, batched cache and
original-bitmap transition changes documented in [gallery-2.2.7.md](gallery-2.2.7.md).
The native viewer is optional and remains experimental. Its video layout reserves
space for Gallery actions, keeping the player's controls visible above them.
Package identity is unchanged; version code 44.

The first CI attempt was blocked before Android tests could execute because
repo1.maven.org returned HTTP 429 for Robolectric's Android framework. Tests now
use Maven Central's canonical repo.maven.apache.org endpoint. No tests were skipped
or relaxed. The older 2.2.7 attempt did not publish an APK.

## Verification

- JavaScript/TypeScript unit suite: 495 passed.
- Signing/update tests: 7 passed, including rejection of version code 43.
- Final TypeScript, targeted ESLint, mobile build and Capacitor sync passed.
- Production build passed; existing local database fallback warnings remain.
- Full local Android debug suite: 171 passed, no failures/skips.
- Full local Android preview suite: 171 passed, no failures/skips.
- Browser Gallery regression, Library/backup regression, Places workflow and
  390×844 update-dialog centering checks passed. Gallery checks include quality
  preset changes, shared opening/closing, slow originals, opening reversal,
  missing thumbnails and rapid pointer/keyboard navigation. Native/cloud calls
  in browser checks use fixtures; native unit tests execute Android code through
  Robolectric. No physical-device or frame-time measurements are claimed.
- Places screenshots: `work/qa-places/places-desktop.png` and
  `work/qa-places/places-mobile.png`. Update screenshot:
  `work/qa-updates/updates-mobile.png` (all local fixture content).

## Phone checks

Install over Atlas, without uninstalling. In Gallery settings choose Saver,
Balanced and High, then check the same portrait/landscape tile. Fine-tune JPEG
quality and maximum pixels if desired. Reopen settings to confirm persistence;
clear previews and confirm originals, edits and cloud records remain accessible.

Open several photos, return to the grid, open them again, and dismiss before
opening completes. Check Places → Saved places, Review new places, Map, a place's
photos, Edit place, Add to trip and Undo under More. On a long video check seek,
play/pause and action-bar separation. The optional native viewer should be tested
separately; leave it disabled if its gestures do not yet suit the phone.

Native-session pagination beyond the loaded collection, thumbnail-to-native
screen transitions and extraction directly inside the native screen remain
limitations. Info/More returns to Atlas tools; cloud media uses the WebView viewer.
No personal cloud writes, credential changes, uploads or data resets occurred.

## Signed release

- [CI run 45004185896](https://github.com/Saikrishna65/life-atlas/actions/runs/45004185896):
  install-update job 137152065978 succeeded, including both native test suites,
  APK builds and signing compatibility checks. The personal-cloud job was skipped.
- Application source: `32b84f126afc5883ba7d7885d4552d1f67445d59`.
- [Atlas APK](https://github.com/Saikrishna65/life-atlas/releases/download/atlas-install-update-45004185896/atlas.apk):
  `com.lifeatlas.app.next`, version 2.2.8, code 44, 74,322,352 bytes.
- SHA-256: `198f739c5b93d44c21537a5aaff7766dcf135e3a1308c43f54472dc28adf9a04`.
- Signer SHA-256: `2f19571f9d6a4a3b4c7250397b7618f04e047beeeaa0023713e2a6c0a745af7d`.
- Downloaded APK verified locally with apksigner and aapt; bytes and checksum
  match the public updater manifest. Compared with 2.2.6, APK growth is 719,926
  bytes (about 0.69 MiB). This is a package-size measurement, not a phone latency
  or battery benchmark.
- Install over Atlas without uninstalling; the preserved certificate matches.
