# Atlas Gallery 2.2.6

Includes the 2.2.5 mosaic and compositor transition work described in
[gallery-2.2.5.md](gallery-2.2.5.md). A final uncovered path now applies the one-time
stage fade to photos without an available grid thumbnail, as well as videos.
This does not reintroduce the dialog entrance animation at image handoff.
Failed thumbnails retry locally without broadcasting a reset of other instances’
retry guards, preventing unbounded retries when a preview remains unavailable.

The grid uses bounded square cells, occasional two-cell wide tiles and four-cell
squares, with a four-column phone default. No media is rewritten. New background
thumbnail work pauses while the viewer is open; purposeful near-end navigation
continues to fetch more media.

## Validation

- Local unit suite: 495 passed. TypeScript, targeted ESLint and seven signing/update
  tests passed.
- The missing-thumbnail browser scenario passed, including a one-time fade and at
  most one retry per failed thumbnail. The earlier normal/reduced-motion, stalled
  original, opening reversal, mobile mosaic and controlled paging scenarios passed.
- Full Gallery normal-motion regression passed for the shared mosaic/motion work.
  Native/cloud responses in browser checks are fixtures; no personal data is used.
- Mobile build and Capacitor sync passed. The production build for the shared work
  succeeded with the documented local PostgreSQL-fixture fallback warnings.

Signed release evidence follows below. Physical Android frame pacing is not
measured in this environment; browser tests do not establish phone smoothness.


## Signed release evidence

- [CI run 44979631233](https://github.com/Saikrishna65/life-atlas/actions/runs/44979631233):
  compatible-update job succeeded, including debug/preview native unit tests and
  both APK builds. The live personal-cloud job was skipped.
- APK application source: `c50df6fde5c10956aad5a07035878a8a68c8ea56`.
- [Atlas 2.2.6 APK](https://github.com/Saikrishna65/life-atlas/releases/download/atlas-install-update-44979631233/atlas.apk):
  `com.lifeatlas.app.next`, version code 42, 73,602,426 bytes.
- SHA-256: `f916b6e1ee74497036394f383a1b627b5dc5aa65c6dbfb396853e80e3ecf6eb0`.
- Verified signer SHA-256:
  `2f19571f9d6a4a3b4c7250397b7618f04e047beeeaa0023713e2a6c0a745af7d`.
- Local APK package, version, bytes and checksum match the public updater manifest.

Install over Atlas without uninstalling. Check the four-column grid, open/close
several portraits and landscapes, dismiss before opening finishes, and try a photo
whose preview is not loaded yet. Physical-device testing was not performed here.
