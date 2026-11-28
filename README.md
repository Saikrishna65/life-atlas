# Atlas

A personal, local-first Android ecosystem and public travel website: Atlas Gallery, Music, Finance, Trips, Creator Studio, AI, and the Atlas Video browser experience.

**New developer or AI account? Start with the [complete project handover](docs/handover/START-HERE.md).** It explains the architecture, user decisions, source locations, backup systems, unfinished work and validation boundaries without requiring the previous conversation.

- [Project guide](docs/handover/PROJECT-GUIDE.md)
- [Source routes, native modules and documentation index](docs/handover/REPOSITORY-MAP.md)
- [Current account backup/recovery implementation and setup](docs/atlas-account-recovery.md)

## Development

```sh
npm ci
npm run dev
```

Open `http://localhost:3001`. Server-backed features need their configured services; private Android functionality also requires native plugins. The public Next website and the offline Capacitor bundle are different runtimes.

```sh
npm test
npx tsc --noEmit
npx eslint <changed-files>
```

**APK/app-bundle builds are currently paused by the owner.** Do not run mobile builds or trigger APK workflows until requested. See the handover for build commands when the pause is lifted.

## Repository boundaries

This repository contains the main Atlas app and website. The separate NewPipe-based **Atlas Video Android fork is not included**; its source must be transferred separately. The browser Video page is available in this repository at `/video`.

Preserve existing local data, native encryption keys, signing identity and backups. Do not commit credentials, recovery material, personal media or model weights. Current account recovery is a web app-data foundation, not complete native one-click recovery.
