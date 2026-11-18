Atlas 1.4.5 — verified stable signing

1. Keep your existing app installed. Do not clear its storage.
2. If the installed app is Atlas Vault, download atlas-offline-online.apk.
   If it is Atlas Next, download atlas-next.apk.
3. Open the matching APK and choose Update. This build uses version code 12.
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
