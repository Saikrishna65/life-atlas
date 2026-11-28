# Atlas account recovery — implementation status

This introduces account-owned **web app-data** backup. It is not yet a replacement for Android R2 media recovery, nor a complete Atlas account rollout. APK builds remain paused.

## Operator setup (once, not on each phone)

Configure these server-only variables on the deployed Atlas backend:

- `ATLAS_ACCOUNT_ORIGIN`: exact HTTPS origin, without trailing slash.
- `ATLAS_ACCOUNT_EMAIL`: the owner's verified Google email (provided privately in the setup conversation). Only this account is admitted; there is no public registration.
- `ATLAS_GOOGLE_CLIENT_ID` and `ATLAS_GOOGLE_CLIENT_SECRET`: Google OAuth web application credentials.
- `ATLAS_ACCOUNT_MASTER_KEY`: independent random 32-byte key represented as 64 hexadecimal characters. Keep an operator backup in a secret manager. Losing this key prevents account escrow recovery; do not rotate it without a re-encryption migration.

Register `<ATLAS_ACCOUNT_ORIGIN>/api/account/callback` as the exact Google OAuth redirect URI. The existing private Files storage backend and PostgreSQL configuration must also be working. Do not use NEXT_PUBLIC variables for secrets. No R2 credentials are migrated or sent to this service.

Open Control Room → Backup & Restore → Continue with Google → Connect app-data backup. Restore existing data before uploading from a replacement browser. Automatic app-data backup is opt-in and runs while Atlas is open. Phone originals and native gallery analysis are explicitly excluded from this new screen.

## Security and data boundaries

Google authorization-code flow uses state and PKCE. Profile identity comes directly from Google's authenticated userinfo endpoint, requiring a verified allowlisted email. Sessions are purpose-bound AES-GCM cookies: Secure, HttpOnly, SameSite=Lax, host-only, thirty-day expiry. Tokens are not retained. Mutations require the exact configured Origin and a custom header. Owner IDs derive from Google's stable subject, not a client-supplied email.

A random backup encryption secret is escrowed encrypted under the server master key at `atlas-system/accounts/<subject-hash>/recovery-v1.json`. PostgreSQL advisory locking serializes initial creation. A missing file can initialize a new account; unreadable or corrupt existing files fail rather than being replaced. Server access to recovery keys is an intentional change from device-only custody.

The new account vault endpoint binds every request to the session's vault. Existing quarantined sensitive APIs remain denied. Legacy backup links are preserved and cannot be automatically enrolled or replaced. The existing encrypted chunk and integrity-validation machinery is reused. Restoring replaces saved app-data sections, with explicit confirmation. Signing out clears this device's account backup connection, not its app data.

## Remaining before Android one-click recovery

- Native browser sign-in handoff with verified app links and securely stored device sessions (Google login must not run inside the embedded WebView).
- Enroll existing native private-media encryption keys and R2 connections with explicit migration consent, without creating incompatible replacement keys.
- Coordinate native originals, gallery organisation and app-data checkpoints into one restore manifest; distinguish partial from complete protection.
- Account device/session revocation, server key rotation, durable snapshot retention and migration/restore testing.
- Real provider/deployment verification and new-phone recovery testing. Unit tests are not evidence of these.

Public website publishing and existing private storage are unchanged. Do not discard existing recovery kits until a migrated backup has passed a restore rehearsal.
