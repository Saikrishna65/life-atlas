Atlas Vault 1.3.1 — Android cloud sync fix

Install
1. Download and extract atlas-offline-online.zip, then install atlas-offline-online.apk.
2. Try cloud setup again in your installed APK first: the server compatibility fix also supports the previous version. You may not need to reinstall.
3. This update keeps the existing local-data epoch and does not repeat the database reset. Do not uninstall an app containing unsaved local data. If Android reports a signing conflict, keep your installed app and use its cloud setup after the server update; save the recovery code and upload before considering reinstalling.
4. The native HTTP transport now preserves cloud authentication and app-origin headers. Automatic uploads turn on after cloud setup connects successfully.

Cloud upload and reinstall recovery
1. Open Control Room → Cloud → Create cloud vault.
2. Copy or save your recovery code outside the app and confirm you have saved it.
3. Connect and upload. Automatic uploads save new local changes while online. Each section also has its own Upload and Restore buttons.
4. To test reinstall recovery, wait until the sections show Up to date, then uninstall and reinstall the app.
5. Open Control Room → Cloud → I already have a recovery code. Enter it or choose your saved code file, then Connect & restore.
6. Trip Vault, Music, Finance, Studio and app preferences return from the cloud, including original local audio and attachments saved in that copy. You can restore again whenever needed. Restore replaces the selected device sections with their saved cloud copy.
7. Keep the recovery code. It is required to unlock your encrypted cloud files and cannot be recovered from the server if lost. Android permissions are device-specific and must be granted again after reinstalling.

Access and rules
- Music and audio: check/request Android audio-library access. The system file picker also supports importing chosen songs without broad library access.
- Notifications: allow reminders and Finance review alerts.
- Bank notification access: grant Atlas access in Android settings and enable tracking. Supported incoming Kotak messages from Google Messages can then be reviewed in Finance; historical SMS are not read.
- Automatic uploads: enabled after cloud setup; local features remain available offline.

Storage
On-device records and media are measured separately from cloud files. Cloud-only music consumes cloud storage even when it has no local audio copy. Neon object storage stores files; the app database stores published records and Music metadata. Its allocated size includes indexes and internal overhead and does not become zero after clearing records.

Validation
The release workflow checks types and tests, recovery after two simulated reinstalls, live encrypted upload/download against the deployed cloud service, responsive Control Room screens, the current Android plugins and APK signatures. Phone-specific permissions, background playback and widgets still require device testing. Online YouTube, AI and publishing depend on their hosted services.
