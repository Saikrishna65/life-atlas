Atlas Vault 1.4.1 — trip ideas without dates and exact travel times

Install safely
1. Download and extract atlas-offline-online.zip.
2. Install atlas-next.apk (Atlas Next). It uses com.lifeatlas.app.next and installs ALONGSIDE the existing Atlas Vault app. You do not need to uninstall or clear your existing app. Local databases and Android permissions are separate between the two apps.
3. You can test the redesign immediately with new data in Atlas Next. To bring across existing records, first finish Upload all in the original app, save the recovery code outside both apps, then connect and restore that cloud copy in Atlas Next. Neither app automatically imports the other app's local data.
4. If the original app has a cloud conflict and new local records, first use https://life-atlas-eight-five.vercel.app/cloud-recovery to preserve the current cloud snapshot, then return to the original app and Upload all. Do not use Restore all over unsaved local data.
5. atlas-offline-online.apk is the standard com.lifeatlas.app build. Its signing key differs from v1.3.1, so Android cannot update that version in place. Do not uninstall a standard app with unsaved local records; use the Preview APK for testing. See signing-compatibility.json for verification.
6. No app or cloud databases are reset by this release. The existing data epoch is unchanged. Preview starts with its own empty local storage because it is a separate Android application.

What changed
- Trip Vault has an overview and five sections: Plan (days, travel, food, suggestions), Bookings (tickets, files, reminders), Money (shared Finance ledger), Checklist (packing and reminders), and Memories. Creating a trip starts with its name, destination and dates; more fields are optional.
- Earlier manual trip expenses remain in Money. Linking one to Finance requires selecting an account and confirmation; the original stays saved. If already recorded, attach the existing payment instead. Saved deposits have separate refund-status controls.
- Control Center uses a light monochrome design, compact rows and bottom navigation. Trip Vault has a separate photo-led stone, midnight and cyan palette. Finance and Music themes are unchanged.

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

Trip ideas and travel times
You can save only a trip name and destination using Save trip idea. Dates are optional. Ideas appear in the Ideas filter, and relative Day 1 / Day 2 plans do not receive invented calendar dates. Add dates later in Trip details; undated plan days then receive dates from the chosen departure date. When choosing dates, select Departure time, Return time and Travel timezone. Unknown return dates stay unknown; automatic payment grouping waits for a complete, confirmed window.

Update signing
Atlas Next has a separate app identity from both the earlier Atlas Vault and Atlas Preview builds, so all those installed apps can stay in place. This release begins a persistent private signing identity for future Atlas Next updates. The signing key is kept on the server, released only to authenticated owner build workflows, and never included in the ZIP.
