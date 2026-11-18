Atlas 1.4.9 — verified stable signing

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

Trip publishing: verify your device once for the reviewed batch, instead of once
for each upload and publication. This grant covers only the chosen public files,
their saved transfers and this trip collection. It ends on finishing, pausing,
leaving the app, 30 minutes idle or two hours total. Credential changes, deletion,
private operations and unrelated uploads still require separate verification.

Finish uploads later saves your place selections and completed publications.
An upload already running may continue in native Cloud Storage. Resume publishing
reuses verified files and retries the same paused/interrupted transfer IDs where
supported. A file at 100% can still be undergoing checksum verification. Place
counts refresh as records finish; the website changes only at the final publish
step. No personal cloud access or physical-device tests are part of this build.
