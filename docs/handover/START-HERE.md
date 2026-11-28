# Atlas: handover to a new developer or AI account

**Snapshot: 28 November 2026. Source baseline: `454b22b`.** This guide describes code and known validation, not a production-readiness certification. Read it before changing the project. No prior chat is required.

## Read in this order

1. This file: purpose, user preferences, critical boundaries and immediate work.
2. [Project guide](PROJECT-GUIDE.md): architecture, modules, storage, operations and troubleshooting.
3. [Repository map](REPOSITORY-MAP.md): source routes, native modules and specialist documentation.
4. [Account recovery implementation](../atlas-account-recovery.md): the current unfinished task.
5. The relevant module's documentation and source before editing it.

Older documents are implementation-session reports. Their “not pushed,” test counts, build status and feature limitations describe their date, not necessarily current main. Later code and this dated handover take precedence. Never treat an old screenshot or compiled APK as proof of current device behavior.

## What Atlas is

Atlas is a personal, local-first Android ecosystem plus a public travel website. The main Android app contains Gallery, Music, Finance, Trips, Creator Studio, Atlas AI and Control Room. Atlas Video is both a separate NewPipe-derived Android application and a distinct browser implementation hosted by the main website.

The owner wants everyday usability comparable to familiar consumer apps, fast opening/navigation, little battery/storage overhead and control over their data. Public travel media must never reveal private Gallery/Finance/AI data accidentally.

Current user-facing names: **Atlas**, **Atlas Gallery**, **Atlas Music**, **Atlas Finance**, **Atlas Video**, **Atlas AI**. Old `life_atlas`, `LifeAtlas`, `vault`, package names and database identifiers still exist for compatibility. Do not rename persisted identifiers as a cosmetic branding cleanup.

## Repositories and what a fresh clone misses

| Item | Current location / identity | Meaning |
| --- | --- | --- |
| Main repository | `https://github.com/Saikrishna65/life-atlas` | Website, packaged Atlas app, native Android plugins, tests and docs |
| Main working checkout | `/workspace/life-atlas` | Paths in previous chats refer here |
| Working branch at handover | `feature/atlas-local-intelligence` | Latest work was pushed to `main`; this name is not evidence that the code is missing from main |
| Latest implementation commit | `454b22b` | Account-owned web app-data backup foundation |
| Other worktree | `/workspace/life-atlas-integration`, branch `integrate/website-atlas-ai`, observed `5850915` | Older integration checkout; do not overwrite main from it |
| Separate Video repository | `/workspace/atlas-video`, branch `atlas-video` | Customized NewPipe source; **not included in a main-repository clone** |
| Video remote | `upstream` → TeamNewPipe/NewPipe; upstream push disabled | No Atlas publishing remote observed; preserve this separate checkout before moving environments |
| Website | `https://life-atlas-eight-five.vercel.app` | Existing name retained; `/video` is the browser Video page |

Check `git status`, `git log` and remote refs yourself. A successful push triggers the configured deployment workflow but is not evidence that Vercel finished successfully.

To preserve Video, transfer its complete tracked source and required dependency/submodule instructions to the new workspace or an owner-approved repository. Do not include signing keys, credentials, device data, build caches or unrelated workspace files. Keep GPL notices and corresponding source when distributing a modified APK. Documentation alone cannot reconstruct that fork.

## Standing user instructions

- **Do not build APKs or app bundles until the user asks again.** The owner's Moto Edge 50 Fusion (Android 16) was being repaired; no phone testing is currently available. Source edits and suitable tests are welcome. Do not trigger CI APK builds as a workaround.
- The user previously requested changes be pushed to `main` for Vercel updates. Check the current branch/remote and push only reviewed, relevant work; never force-push or silently include someone else's changes. Source push does not prove deployment success.
- Avoid repeated permission questions for ordinary authorized implementation. Ask when missing real configuration or a consequential decision blocks work.
- Preserve local originals and existing backups. Historical willingness to delete old cloud data is **not** an instruction to wipe it now.
- No personal-data uploads, production resets or test deletions for validation. Use synthetic fixtures.
- Default optional local authentication is off; settings allow individual scopes. No new AI phrase/password prompts. Android permissions, deletion confirmations and explicit publishing approval are separate requirements.
- Latest decision: the user wants **one Google account login and one-click recovery without user-managed codes**. They accepted server-managed recoverable keys. That changes the earlier device-only recovery preference, but does not authorize silently exporting existing native credentials/keys.
- Owner Google email was supplied in the private setup conversation. Configure it as server-only `ATLAS_ACCOUNT_EMAIL`; ask the owner privately if it is unavailable. Do not commit personal account details or credentials.
- Do not claim hardware-backed security, “zero battery drain,” real inference, instant loading, background survival or physical-device validation without evidence.

## Current task: simple account backup and restore

The user found separate backups/recovery kits confusing. Desired final experience:

1. Sign in once with Google.
2. Choose protected categories; automatic backup with clear progress.
3. On a new phone, sign in to the same account and tap Restore.
4. Small essential records return first; originals download later.
5. No repetitive authentication or separate recovery-code entry.

**Implemented at `454b22b`: web app-data foundation only.**

- `/secret/account` linked from Control Room's overview.
- Google authorization-code sign-in, state, PKCE, verified-email allowlist.
- Server-protected account session and per-Google-subject recovery secret.
- Account-owned encrypted app-data backup using existing chunk/restore machinery.
- Separate API enforces session ownership; quarantined legacy APIs remain blocked.
- Refuses silent replacement of a legacy backup connection.
- Clear native/unconfigured notices rather than claiming recovery works.
- Unit tests: 678 passed at that implementation; TypeScript and new-code lint passed.

**Not implemented/verified yet:** native browser-to-app Google sign-in, native session storage and revocation, migration of current private R2 keys/credentials, unified original-media/gallery/app-data restore checkpoints, actual Google provider setup, live sign-in, independent new-device restore.

The Android offline router also needs explicit account route wiring; adding a Next page does not automatically add an offline route. The current native notice is not a completed authentication bridge.

The operator needs OAuth client settings, exact HTTPS origin, allowlisted owner email and a securely retained server master key. See [setup](../atlas-account-recovery.md). Do not ask the user to paste secrets into chat. Keep existing recovery kits until migrated data passes a real restore rehearsal.

## Suggested next implementation sequence

1. Review the account foundation and configure provider/server secrets through the deployment provider's secure settings. Validate sign-in, wrong-account denial and logout with synthetic account backup data.
2. Implement external-browser Android sign-in with a verified return channel and securely stored device session. Do not embed Google login in the WebView or pass session tokens in public URLs.
3. Add device/session revocation and a key-rotation/recovery plan for the operator-held server key.
4. Design explicit enrollment of existing native Tink keysets and R2 connections. Preserve ciphertext and original key identity. Never solve migration by generating a new key for existing encrypted objects.
5. Introduce one coordinated backup status and restore manifest across app data, native media index, originals and Gallery AI organisation. Partial saves must never say “Everything backed up.”
6. Add migration, corrupt snapshot, offline interruption, wrong-account, process-death and clean-device restore tests. Build/install only when the owner lifts the pause.

## Copy this prompt into the new account

> I am continuing Atlas, a personal Android ecosystem and public travel website. Read `AGENTS.md`, `docs/handover/START-HERE.md`, `docs/handover/PROJECT-GUIDE.md`, `docs/handover/REPOSITORY-MAP.md`, and `docs/atlas-account-recovery.md` before editing. Inspect the actual branch, status and code; do not assume earlier implementations were fully deployed or device-tested. Current work is unifying backups under Google account recovery. Commit `454b22b` only implements the web app-data foundation; Android sign-in and existing R2/gallery-key migration remain unfinished. Keep all existing data and keys. Do not build APKs/app bundles until I ask. The separate NewPipe-based Atlas Video source is not part of this repository and must be transferred separately. Continue with evidence-based implementation and tests, and clearly distinguish source changes from live/device validation.
