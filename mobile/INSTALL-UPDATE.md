Atlas 1.4.12 — verified stable signing

1. Keep your existing app installed. Do not clear its storage.
2. If the installed app is Atlas Vault, download atlas-offline-online.apk.
   If it is Atlas Next, download atlas-next.apk.
3. Open the matching APK and choose Update. This build uses version code 14.
4. Read signing-compatibility.json. An update build must match the published
   1.4.4 stable certificate. A fresh-install build instead verifies the APK against the
   preserved signing key and may NOT update older releases. Use that mode only
   when no app with the same package is installed. Do not remove an app with
   unsaved data just to use a fresh-install APK. Future builds reuse this key.
5. If Android still reports a package conflict, stop. Earlier releases and local
   debug builds can have a different certificate. Do not uninstall to bypass it.
   An in-place update requires the original signing key. Report the installed app
   name, version and where its APK came from.
6. Atlas Next uses com.lifeatlas.app.next; Atlas Vault uses com.lifeatlas.app.
   They have separate databases. Installing Next beside Vault does not import
   Vault data. Neither app needs to be removed to keep the other.

This build does not upload, restore or reset personal/cloud data. It checks types,
signing authorization, APK compatibility, native unit tests, APK signatures,
package IDs and version codes. Actual installation and permissions require a phone.
The ZIP contains SHA256SUMS.txt and signing-compatibility.json for verification.

Maintainers: run “Build offline and online Atlas APK” on main with install_update
checked. The owner must trigger it: existing signing authorization accepts only
the repository owner's GitHub identity. This mode only loads the existing key;
it cannot initialize or rotate it. No signing key is included in release files.

R2 connection fix: requests now use the AWS S3 signer with payload hashes, without
AWS chunked encoding. Native transport errors have safe, actionable diagnostics.
Update the existing Atlas Next app; saved R2 credentials remain in native storage.
No user bucket was accessed by the build or test suite. Retest your connection
inside the app after installing the update.

Creator Studio: create a trip and choose its globe pin, add named places, then
select photos/videos under each place. Up to 20 media files per selection; repeat
for more batches, up to 250 cloud media items per trip. Nothing is uploaded until
you approve publishing. Pending transfers and completed public media are saved
per place. Website updates append media and preserve existing routes/statistics.
The public loader now waits only for the initial viewport, with a four-second
asset budget after hydration. Other scenes and media remain lazy-loaded.

Trip publication recovery: trip photos now create independent immutable publication
records rather than modifying the shared current.json catalog. Existing catalog
entries are retained. The website receives approved trip media through its existing
publishing API. The native library combines existing catalog entries with this
device's securely saved publication index. Standalone legacy catalog publishing
still uses conditional updates and can report a catalog conflict.

Install over the existing Atlas Next app without uninstalling or clearing storage.
Open the existing Creator Studio trip and tap Publish again. Named-place selections
and transfer IDs survive this update; verified completed uploads are reused. The
build does not access your bucket or upload any personal photos.

Trip publishing: verify once to approve this selected public batch. There is no
upload approval timer, foreground requirement, screen-lock expiry or background
expiry. Every selected file is bound to a durable native transfer ID before any
upload depends on WebView polling. A single serial WorkManager graph persists the
whole batch, with network constraints, foreground transfer notifications and the
existing multipart recovery and original-byte verification.

Continue in background leaves all approved native uploads queued. You can use
other app screens or lock your phone. Android may delay work, enforce background
quotas or stop the process; uninterrupted execution cannot be guaranteed. WorkManager
retains committed jobs, and retry recovers the same saved IDs instead of uploading
completed originals again. Explicitly paused/cancelled files are not silently
made public by an unrelated operation. Resuming a reviewed batch retries paused
or failed jobs; cancelled jobs require review in Cloud Storage.

The website update can finish while the WebView remains active. If Android suspends
or destroys it, return to this trip to finish the website metadata update using
already verified native uploads. A restarted/replaced publishing session may need
one fresh verification; this does not stop committed native uploads. Configuration
changes, deletion, private storage and unrelated files still require authentication.
The in-memory public grant ends only when this workflow finishes/stops, is replaced,
the process ends or credentials change; it cannot authorize arbitrary bucket access.

Install over the existing Atlas Next without uninstalling or clearing storage.
Your existing named-place selections, transfers, original media and route data are
preserved. No personal cloud uploads or physical-device tests run in the build.

Stopped uploads: Cloud Storage → Transfers now shows Android WorkManager status,
queued dependencies, retry scheduling, quota/background stop reasons where Android
provides them, and separate verification bytes. Running files sort before later
queued files. Native transient failures remain queued while Android retries them;
the publisher no longer appends duplicate jobs during that backoff.

Use Resume approved uploads to restore missing/finished scheduler work for existing,
previously approved public trip uploads. It reuses the same object keys, file URIs
and multipart state. It skips running/scheduled work, completed files, manual pauses,
cancelled jobs, private/unapproved uploads, changed credentials and non-transient
permission/authentication failures. The publisher attempts this recovery once if
its current approved upload has no active Android job. No expiry was reintroduced.

The exact cause of the reported phone stoppage was not available during implementation.
This build adds actionable status and narrow recovery rather than claiming a specific
on-device cause. Physical-phone and live-bucket testing are still required.
