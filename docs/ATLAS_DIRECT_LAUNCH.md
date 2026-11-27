# Direct module launch

Atlas Finance, Atlas Music and Atlas Gallery share the existing Atlas package,
settings, databases, security guard and player. Atlas Video remains a separate
companion app. No data migration or duplicate media library is introduced.

## Opening

After a future APK update, the Android app drawer contains Finance, Music and
Gallery entries as well as Atlas. Drag an entry to the home screen, or use
**Atlas → Apps → Add to home screen** and confirm with the launcher. Launcher
support varies; Open remains available when pinning is unsupported. The old
Gallery shortcut API is retained.

## Startup behavior

- A read-only native interface exposes only the allowlisted initial module route.
  It is installed before Capacitor loads its first document.
- The mobile bootstrap selects the route before importing/mounting the app, so
  a cold module launch does not mount the hub first.
- Intents arriving during startup are handled before React is ready. Once ready,
  the existing mobile router handles them without reloading the WebView.
- Warm switching preserves the mounted shared shell/player and existing optional
  authentication policies. No additional background service or scanning is added.
- Existing route prefetching loads the selected module; this change does not
  prefetch all three modules at startup.
- Native and TypeScript route validation reject external URLs and unsafe paths;
  native event arguments are JSON-quoted, not interpolated as executable code.

## Validation (2026-11-27)

- 636 TypeScript unit tests passed, including cold/early/warm intent handling and
  route rejection. TypeScript check and scoped ESLint passed.
- Platform-independent Java launcher/route contract compiled and passed using
  the installed Java compiler module. Manifest, labels and icon XML parsed.
- Chromium source fixture: all three cold destinations selected before React;
  nine warm switches; exactly one document navigation per session; no page errors.
- Existing mobile navigation source fixture passed Back/Forward, lazy screens,
  Gallery layer history and scroll restoration at a mobile viewport.

These are source-level checks, not physical-device startup measurements. No app,
production or APK build was run. Full Android compilation, launcher pinning,
actual music playback continuity and cold-start timings remain device checks for
when the phone is available. The added launcher entries require that future APK
update; editing source cannot change an already installed APK.

## Repeat checks

```sh
npm test
npx --no-install tsc --noEmit
node tests/mobile/launch-browser.mjs
node tests/mobile/navigation-browser.mjs
java com.sun.tools.javac.Main -d /tmp/atlas-launch-java \
  android/app/src/main/java/com/lifeatlas/app/LaunchRoutes.java \
  tests/mobile/LaunchRoutesCheck.java
java -cp /tmp/atlas-launch-java LaunchRoutesCheck
```
