# Atlas Apps and Atlas Video on the web

Implemented on `feature/atlas-local-intelligence`, continuing the existing branch. No app extraction, main merge, remote push, deployment, release upload, APK build or device installation was performed for this change.

## Open it

- Atlas home → **Atlas Apps**, route `/secret/apps` in Next.js and the offline Android router.
- **Open web player** → `/secret/video` on the same Atlas website. No separate web deployment, API key or paid service is required. These routes become live when the main Atlas website is deployed with this code.
- The Android hub checks installed Atlas Video, opens it, checks releases, downloads/cancels, shows byte progress and Wi-Fi preference, verifies an APK and opens Android’s installer. Android asks for installation approval and, when necessary, permission to install apps from Atlas. Atlas cannot install silently.
- The web hub checks the same catalog through `/api/apps/catalog`, offers the published APK/source, and always offers the browser player. It never pretends an APK is already published.

## Current release status

The separate source exists at `/workspace/atlas-video`, package `com.lifeatlas.video`, based on NewPipe with GPL-3.0-or-later. That checkout’s documentation records no validated built APK or fork release feed. It has only an upstream remote, not a configured Atlas publishing remote. There is no existing Video web deployment; the user confirmed that only the main Atlas website was deployed.

The in-app installer is implemented, but **a trusted signed Atlas Video APK and its corresponding source must be published before its first download/install can work**. The hub clearly reports no published release instead of using a fake APK URL or sending users to official NewPipe. No APK was built or release published during this task.

## Installer trust and lifecycle

`AtlasCompanionPolicy` fixes the only allowed package and signing root in native code. Remote catalogs cannot add arbitrary applications or change the trust root. Expected certificate SHA-256:

`f396d14bbd2076769e0edb46a3a8c4a4d4d45b57ae90a0ddd70e226e65d2d36f`

This is the existing Atlas workspace signing certificate, **not a private key**. The Video release must use its corresponding trusted key. Do not generate an unrelated debug key or replace this pin from untrusted manifest metadata. If you decide on a different production signing identity, update the reviewed trust policy/packaging tests together before releasing the hub.

Discovery reads up to 50 recent releases from `Saikrishna65/life-atlas`, accepts non-draft/non-prerelease `atlas-video-*` tags and the `atlas-apps.json` asset. It requires:

- Exact package, positive version and bounded APK size (300 MiB).
- Exact SHA-256, pinned signer metadata and native APK certificate verification.
- Fixed HTTPS GitHub release origins and host-checked redirects.
- `atlas-video.apk` and `atlas-video-source.zip` from the same Video release.
- APK package/version/size/hash/signature agreement; existing installed signer agreement; no downgrades or reinstall of the same version; supported device minimum SDK.

Only explicit checks/downloads run; no new startup network task, always-on service, microphone, model copy or background idle polling is added. Polling runs only while the hub’s operation is active and visible. APK bytes stream natively into an app cache partial; unsuccessful partials are removed. Interrupted downloads restart; resumable/background-surviving transfers are not promised. A completed cache APK can be reverified/reused after a restart. The installed flag comes from PackageManager after Android installation, not from assuming the installer succeeded. Existing Atlas self-updates are unchanged.

No gallery, history, R2 credentials, assistant memory or vault content is transferred to the companion. Merely installing Video does not implement a future AI command bridge.

## Prepare the first release locally

1. Build the **release** variant from the Atlas Video source with its declared upstream JDK/Android SDK requirements. Debug/continuous builds may have a package suffix and are deliberately rejected by the hub.
2. Zip-align and sign the release APK using the trusted Atlas key. Verify with Android SDK `apksigner verify --print-certs`. Preserve the signing key securely; no key is embedded in this implementation or read by the packaging script.
3. Create a ZIP of the complete corresponding modified source, including required submodules/source dependencies or reproducible dependency instructions, build files, notices and GPL license. `git archive` alone does not include uncommitted changes or submodule contents. Confirm this source actually corresponds to the APK; a ZIP header check cannot prove correspondence.
4. Run, with JDK and Android SDK tools available:

```sh
ANDROID_HOME=/path/to/android-sdk JAVA_HOME=/path/to/jdk \
node scripts/create-companion-release.mjs \
  /path/to/signed-atlas-video.apk /path/to/corresponding-source.zip \
  atlas-video-1.0.0 companion-release
```

`AAPT` and `APKSIGNER` can select installed SDK tools. APKSIGNER may be the SDK’s `lib/apksigner.jar`. The script checks the actual APK signature/package/version, computes actual bytes and digest, and prepares three files. It does not build, push, create a release or upload anything.

5. Review the output. With your explicit publishing authorization, attach all three files to the matching `atlas-video-1.0.0` GitHub release in the Atlas repository. Keep corresponding source available when distributing the GPL APK.
6. In Atlas Apps, check releases, download and approve Android’s installer. Test cancel, offline handling, wrong signature/hash/package, low storage, installed-app detection, update and user-canceled installation on a device. These device flows were not executed here.

## Browser player

- Search public videos or paste a valid YouTube link/ID. Requests use POST `/api/video/search`, not query-string history.
- Search uses the already installed `youtubei.js` dependency server-side. It supports classic Video and newer LockupView results, bounds query/result sizes and has a request timeout. No user API key, new database or cloud service is introduced.
- Thumbnail results, titles/channel/duration, privacy-enhanced `youtube-nocookie.com` embed, native YouTube playback controls/fullscreen and an external YouTube fallback.
- Mono, Paper and Ink appearances; only the selected theme is persisted locally.
- Bottom Search / Player / You navigation. Search results/current playback are React memory, without watch/search history, session restore, URL query history, analytics or IndexedDB writes added by this feature.
- YouTube receives playback/search requests and can have its own cookies/logging; infrastructure providers may retain network/access logs. This is not a zero-network-trace claim. Iframes load only after selecting a video or submitting its link.

This is a browser companion, **not the full native NewPipe app running in a browser**. YouTube ads, embedding restrictions, age/region requirements, browser media policies and server extractor blocking can apply. No ad-free/Premium feature parity, browser background-playback guarantee, stream downloading or account sync is claimed. Search failures show an honest message while pasted-link playback remains available. The main mobile bundle uses the existing deployed-service URL helper for API requests; installing this source-only change requires a future Atlas build.

## Music and Gallery opinion

Keep both integrated while this first companion establishes installation/update reliability. Next, review Gallery first because it has a clear standalone launcher/use case, then Music. Define ownership/migration of indexes, albums, playlists, permissions and cloud status before extracting either. Use explicit, signature-protected interfaces rather than duplicate databases or unrestricted shared storage. Keep one optional LLM in the main Atlas app; each media app’s basic browsing/playback should work independently. Neither module was extracted in this task.

## Validation — 26 November 2026

| Check | Result |
|---|---|
| Full existing TypeScript test suite | 549 passed, 0 failed (`npm test`) |
| Companion release packager | 1 test passed; rejects wrong package/signer/version/tag and calculates real byte/hash metadata from supplied fixture bytes |
| Native companion policy | 5 real JUnit tests passed: fresh install, fixed signing root, unknown/duplicate package, invalid version/cross-release source and non-integer metadata rejection |
| Native bridge source | `javac` compiled the actual policy/plugin against installed Android SDK 34, Capacitor and AndroidX classes. This is not a full Gradle build or Android runtime test. Existing Kotlin annotation/deprecation warnings were emitted |
| TypeScript / scoped ESLint | Passed for new pages, components, libraries, APIs and tests |
| Offline mobile bundle | Passed, 203 generated assets; the two new screens remain lazy routes. No APK built |
| Production Next build | Passed; `/secret/apps`, `/secret/video`, `/api/apps/catalog`, `/api/video/search` generated. Existing Prisma data fetches used established fallbacks because the database is unavailable here |
| Responsive browser | Actual Chromium at 390 and 1280 px: hub/navigation, honest no-release state, search result fixture, correct embed destination, close player, theme switch, no search/playback restore after reload, no overflow/page errors |
| Actual API | Invalid queries rejected with HTTP400. A live provider search failed with `TypeError: fetch failed` in this environment; the API returned its intended HTTP503 guidance. Live YouTube streaming/search success is not claimed |
| Integrity / scope | `git diff --check` passed. Main updater, native Video source, Music/Gallery implementations, public hero/globe and personal data unchanged |

The first production build attempt encountered a missing target for the existing `/tmp` Next cache symlink after the environment restarted. Recreating that generated cache directory resolved it. No source fallback or type check was disabled.

Browser tests intercept only the search/release API with clearly labeled UI fixtures and block external media; they do not simulate real streaming or Android installation. Thumbnail failure has a neutral play placeholder rather than a broken-image icon. No APK bytes, signing key, source release or personal data were uploaded. Signature/hash verification of a real companion APK, Android installer approval/cancel, unknown-source settings, installed app launch/update and phone background behavior remain device acceptance checks.

Actual browser captures (offline fixture mode): [Apps · mobile](previews/apps-390.png), [Apps · desktop](previews/apps-1280.png), [Video · mobile](previews/video-390.png), [Video · desktop](previews/video-1280.png).
