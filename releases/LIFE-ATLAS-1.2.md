# Life Atlas 1.2

Full Private Atlas app, package `com.lifeatlas.app`, versionCode 3. A normal launch opens Private Atlas, not Music Vault. Existing app identity and local database origin are preserved.

- Artwork-led Music home, dashboard music widget, mini-player, Now Playing and shared visual styling; real artwork colours and reduced-motion support.
- Android home widget uses real song details/artwork, not a synthetic visualizer.
- Restored existing cloud sync/backup/restore/download entry points and YouTube link/share/import flow. Missing cloud tracks and playlists restore without overwriting local edits. Native audio is persisted before imported copies are saved.
- Optional Android strict offline mode blocks cloud, YouTube and remote artwork requests. Imported music does not require a server.

Validation: 246 tests passed (including cloud restore preservation/failure regression tests), TypeScript, web production build, Android debug assembly, offline Chromium import/playback/reload/search/navigation/backup flows at 390×844, mobile screenshot inspection, and APK signature verification. Focused new-component lint has no errors (one local-image optimisation warning); older cloud/share modules still have existing lint findings. No Android device/emulator was attached: actual widget, background playback, cloud service and live YouTube downloads remain unverified. Cloud requires the existing deployed Life Atlas API and configured object storage/database; no backend deployment or new API keys are included. Metadata enrichment, ReplayGain and crossfade remain unimplemented; encrypted archives retain the 64 MB bound. Source changes are committed locally in the development workspace as 7789c79; this download branch contains the APK and release notes only.

Debug certificate matches the 1.1 APK from this chat. Updating the repository's older APK requires its original key. Do not uninstall or clear storage to resolve a signature mismatch.

APK SHA-256: `a8184232b91296ace141b32de36ec9d088d9c1a01c795923b7b210b41fcc8d7b`
Size: 12,031,854 bytes.
