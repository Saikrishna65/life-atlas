# Optional authentication — code-only implementation

## User-visible behavior

Control Room → Security & authentication has eight independent, default-off
switches: app opening, Gallery/private cloud library, private sections, cloud
credentials, publishing, deletion, backups/recovery and AI local actions.

No authentication is required on a fresh configuration. Enabling protection verifies
ownership using Android's fingerprint/device-PIN interface. There is no separate
Atlas PIN, enrolled app passkey or new assistant passphrase. The retired plaintext
Atlas PIN is removed from localStorage when the security module loads. Cancelling verification
preserves the old settings. Existing delete/publish confirmations, module permission
grants, Android permissions and the Android screen lock remain independent.

A verified owner session lasts while Atlas stays in the foreground. Backgrounding
clears it; returning rechecks only enabled protections. Verification prompts reuse
one native owner session, including policy changes. Native authenticated operations
honor the app-wide check as well as their own category. Approved transfer workers and
existing publication batches keep their approvals; no per-file or timed authentication
was added. Background voice fallback refuses protected local actions rather than
opening a biometric sheet in the background. Basic public voice replies remain available.

Music playback state lives outside the optional page gate. With checks disabled,
normal navigation does not unmount the workspace or introduce an unlock screen.

## Native design

`AtlasSecurity` centralizes scopes and Android biometric/device-credential verification.
Policy is an atomic, strict boolean-only record under Android's no-backup directory,
not in localStorage, cloud configuration or a server. Malformed settings fail closed.
`AtlasSecurityPlugin` accepts only bundled HTTPS localhost calls. Its methods expose
safe policy values, verification and assistant state operations, never encryption keys.
The new plugin is registered with the existing Android app; package/signing identity
and version metadata were not changed.

R2 protected operations now consult the shared policy rather than unconditionally
requesting biometrics. Multipart operations obtain their actual bucket scope from the
saved transfer. Device trash is covered as well. Local file/music/trip/transaction
removal, explicit cloud restore and music export use the matching policy. Existing
background uploads and automatic encrypted sync do not acquire new UI prompts.

Atlas AI now opens a separate, Keystore-encrypted native record automatically. AES-GCM
uses a dedicated Keystore alias and randomized IV; files are atomic and excluded from
Android backup. Revision compare-and-swap prevents stale writes. There is no plaintext
storage fallback and no returned/persisted JavaScript encryption key. No hardware-backed
claim is made. Foreground reopening reloads saved conversations automatically.

## Recovery without setting another password

Cloud Storage provides a native Save recovery file and Verify/restore recovery file
workflow. The file contains the existing Tink streaming keyset, never R2 access tokens.
It needs no password to create or use. It is a **sensitive, unpassworded key file**:
anyone holding it can decrypt the matching backups. The UI requires acknowledgement
and instructs keeping it separate from media/archives and independent of this phone.
Read-back verification rehearses authenticated encryption/decryption and refuses to
silently replace a different installed key. Private uploads still require verified
recovery. Exporting a copy alone does not verify that new copy.

Assistant export uses the existing Tink/R2 envelope implementation with a distinct
assistant archive context. Import decrypts natively with a size limit; the validated
assistant store merges copies under new IDs rather than replacing current records.
A recovered key file can therefore unlock encrypted assistant archives on a new device.
Native pick/upload paths reject recovery-key files, including recognized recovery
JSON under a renamed file, before new uploads. The file must not be stored with archives.

Earlier phrase-encrypted IndexedDB conversations and password-protected R2 recovery
kits are preserved. Optional legacy import tools are in Control Room. They use only
an **existing** phrase to recover old ciphertext; they never ask to create a new one.
The AI page has no phrase/PIN/password field. Without the earlier phrase, old ciphertext
cannot be automatically migrated; it is not erased or overwritten. New conversations
use the device-secured store independently.

## Validation and limits

- 512 JavaScript/TypeScript unit tests passed, including default-off settings,
  invalid-policy rejection, route scope selection, automatic device-store opening,
  persisted messages, stale-write rejection, safe archive merging and late-result
  cancellation. Existing legacy encrypted-store and recovery tests remain covered.
- TypeScript and targeted ESLint passed. Existing image advisories remain in cloud UI.
- Authentication browser fixture passed: eight off switches, prompt-free default
  navigation without remounting, verified changes, cancellation preserving settings,
  protected Gallery access and retry.
- Assistant browser fixture passed: automatic opening, message saving, background
  clearing and automatic foreground reopen, with no password field.
- Private-library browser fixture passed with the updated Open library wording.
- Java source formatting/parser checks passed. Native tests were added for policy
  defaults, fail-closed rules, AES-GCM state/tamper detection, recovery round trips and
  key-file upload rejection, but **native compilation and execution were not run**.
- No APK, mobile/production build, release, deployment or personal cloud operation
  was performed. Physical biometric/picker/Keystore/device-migration and background
  behavior still require Android validation when builds resume.

Keystore loss is not an automatic reset. Existing ciphertext is retained. Recovery
requires an independently saved recovery file and, for chats, an exported assistant
archive. This implementation does not silently extract or migrate inaccessible legacy
keys. Frontend tests use native fixtures and do not prove device encryption behavior.

## Android acceptance checks when builds resume

Install an update over the existing package without uninstalling. With every switch
off, open Atlas/Gallery/AI, test connections and publish an approved batch: no app
biometric or custom-password prompt should appear. Enable each switch and verify
cancellation, owner verification, foreground reuse and background rechecking. Confirm
an approved large upload continues while the UI is locked, subject to Android's normal
execution rules. Test fallback voice actions with its switch both off and on.

Export/reopen a recovery file, export chats and rehearse restoration in an isolated
profile/emulator; never erase the working phone to test migration. Verify originals,
current credentials and the earlier IndexedDB vault remain unchanged. Test unavailable
Keystore and damaged policy files for preserved data and fail-closed handling. Run the
new native suites before distributing a future APK; these source-only changes have not
yet passed Android compilation or physical-device testing.
