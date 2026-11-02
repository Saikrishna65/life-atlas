# Bundled Android app

`npm run build:mobile` bundles all private Atlas screens, including Control Room. Capacitor serves these assets from `mobile-dist`; it never needs the hosted website to open screens. Navigation adapters support trips and playlists created on the device.

Local Trip Vault, imported music, Finance, Studio drafts and Control Room remain available offline. The clean test build resets their IndexedDB databases once before mounting the app; new data survives relaunch. The reset marker is unchanged from the previous test APK to preserve any data already created with it. Android backup restoration is disabled for this clean testing package.

Online API requests are forwarded to `NEXT_PUBLIC_MOBILE_API_ORIGIN` (defaults to the existing hosted Atlas service). Capacitor's built-in HTTP transport handles cross-origin requests and uploads. API-relative media links are rewritten to the service origin, and HTML audio streams use that origin as well. Public-site browsers keep their existing relative URLs and transport.

Creator Studio saves locally first, queues offline entries, uploads local images and publishes through `/api/mobile/studio` when connected. Stable entry IDs prevent duplicate publication after a lost response. Saved entries show their publishing status and provide a retry button. The new endpoint and native request boundary must be deployed to the hosted service for publishing and Control Room mutations to work.

`.github/workflows/offline-online-apk.yml` validates types and tests, checks the bundled screens in Chromium, builds all current Android plugins, verifies the APK with apksigner and publishes a ZIP on a GitHub prerelease. The ZIP contains the APK, install instructions and its SHA-256 digest. A previous installation with a different signing key must be uninstalled.

Online AI, YouTube, cloud uploads/sync and publishing depend on the hosted service's credentials and external services. Bank-alert capture needs Android notification access and supported incoming messages. Map directions use the device map service. Native permissions, widgets and background media still need testing on a phone.
