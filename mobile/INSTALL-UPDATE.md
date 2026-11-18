Atlas 1.4.4 — install without removing existing data

1. Keep your existing app installed. Do not clear its storage.
2. If the installed app is Atlas Vault, download atlas-offline-online.apk.
   If it is Atlas Next, download atlas-next.apk.
3. Open the matching APK and choose Update. This build uses version code 11.
4. These APKs use the certificate of the published Atlas 1.4.1 builds (version code 8).
   The build refuses to publish if the preserved key differs from that certificate.
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
