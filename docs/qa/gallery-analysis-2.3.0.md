# Atlas 2.3.0 — analysis health, priority and recovery verification

## Implemented

- Analysis settings has a simple health section: saved records, records checked in
  the current pass, estimated remaining work, tracked failures and queued work.
  The metadata-only pass count is cached for one minute, respects accessible media
  and selected albums, and is labelled as an estimate. Unknown counts stay unknown.
- An encrypted journal tracks at most 2,000 failed source IDs/versions and 2,000
  pending items. Retry queues those failures without clearing records or resetting
  the bulk cursor. Missing/changed sources are revalidated. Old untracked failure
  counters require one explicit locating scan; completed analysis is reused.
  Completed older jobs cannot remove a newly queued version of the same file.
- Opened photos are prioritized after a 350 ms debounce in both viewers, only when
  analysis is already enabled and the album is approved. Twenty priority records
  are handled at a batch boundary; ordinary work remains serialized and retains
  its cursor. Late arrivals at the end of a bulk pass are drained too. Error-state
  retry renews the worker epoch and periodic registration so failed prerequisites
  cannot strand new work. Battery/thermal/storage/charging/model-consent gates stay.
- Newly written thin search entries contain completion metadata so photo-open
  checks avoid stored face crops. Old entries fall back compatibly; no index reset.
- Aggregate search request/phase and completed-batch wall timings stay encrypted
  locally. No query text, filenames, OCR or identity data enters timing records.
  Settings shows sample count, average/latest timing, completed processing time,
  encrypted index bytes and approximate decoded-search cache bytes. Model-download
  and charging wait time are excluded from processing time. Preview cache size is
  read only on opening the details. Metrics can be cleared independently and are
  excluded from cloud recovery. These are measurements, not speed/battery promises.
- Possible-person matches are reviewed one pair at a time with Same person,
  Different people, Skip for now and existing undo. Naming remains explicit;
  reference-photo guidance is clearer. Skipping is not a permanent rejection.
- Verify saved metadata reads the latest private snapshot and decrypts/validates
  its referenced photo records without staging or importing anything. It does not
  pause analysis, change keys, names, favourites or the working index, write public
  or private objects, or trigger a backup itself. It requires native authentication,
  a verified recovery kit and configured private storage, using existing background
  charging/unmetered Wi-Fi constraints. Metadata-only verification does not require
  ACCESS_MEDIA_LOCATION. Last verification time/count and pending-backup status are
  visible. Checking original-photo availability is a separate operation.

## Validation

- TypeScript and targeted ESLint passed.
- 497 JavaScript/TypeScript tests and 7 signing/update checks passed.
- Mobile bundle, Capacitor sync and production build passed (the existing local
  database fallback warnings remain). No public hero/globe code changed.
- Browser Gallery regression passed. Dedicated 390×844 health check passed for
  targeted retry, aggregate-history clearing, layout, opened-photo priority,
  read-only verification UI, single-pair review, skip, rejection, confirmation and
  undo. Browser native/cloud operations use fixtures. Screenshot:
  `work/qa-gallery-v3/analysis-health-230.png`.
- Native Robolectric tests exercise versioned/deduplicated queues, scope/pause and
  current-record gates, cursor preservation, failed-epoch restart, thin completion
  records without face crops, anonymous local metrics, and authenticated read-only
  snapshot validation including tampering and cancellation. Final test counts and
  signed APK evidence are appended below.

## Limits and phone acceptance

No physical-device prediction, frame-time, temperature or battery measurements were
performed. Timings are wall duration, not CPU-energy readings; phase and full-search
samples can overlap. Index-byte totals exclude models and ordinary originals.
Priority is a scheduling preference, not immediate inference or a battery-rule
bypass. WorkManager can defer or stop work; force-stop prevents jobs until reopening.
Journals are bounded, and oversized failure sets may require additional scans/retries.
Verification reads every referenced encrypted metadata object and can take time and
R2 read operations for large snapshots; an interrupted check can be retried and may
start again. A verified snapshot does not prove its originals are present on-device.

Update over Atlas without uninstalling. Open Gallery settings → Analysis activity;
check progress and failed-only retries. Open several photos slowly and rapidly to
check priority/debounce without slowing swipes. Inspect timings after a search,
then clear only performance history. Review a face pair, skip, correct and undo.
With private storage/kit configured, explicitly verify saved metadata, then confirm
that your current names, favourites and index are unchanged. Development did not
perform any personal cloud reads/writes, uploads, restoration or data reset.

## Final verification and signed release

- 497 JavaScript/TypeScript unit tests passed. Seven signing/update checks passed.
- Full local Android debug and preview suites each passed 186 tests, with no
  failures or skips. Native tests include failed-epoch restart and periodic
  registration, cursor preservation and completion-summary privacy checks.
- [CI run 45011262052](https://github.com/Saikrishna65/life-atlas/actions/runs/45011262052)
  succeeded. Install-update job 137173883578 ran native suites, built both APKs and
  checked signing compatibility. Personal-cloud job 137173884574 was skipped.
- Application source: `bf3221d688e67fdc0911ce4c979038a5b516c940`.
- [Atlas 2.3.0 APK](https://github.com/Saikrishna65/life-atlas/releases/download/atlas-install-update-45011262052/atlas.apk):
  package `com.lifeatlas.app.next`, version code 46, 74,339,919 bytes.
- SHA-256: `27668eaea94bcf33f9d71a779196ee4ee04a683fe2e3aa4eca7d306a953c4c6c`.
- Verified signer SHA-256:
  `2f19571f9d6a4a3b4c7250397b7618f04e047beeeaa0023713e2a6c0a745af7d`.
- Downloaded public APK checked locally with apksigner and aapt. Package/version,
  bytes and checksum match the public updater manifest. Existing signing identity
  is preserved; install over Atlas without uninstalling. APK growth from 2.2.9 is
  12,626 bytes; no new model or runtime dependency was added. This is a package-size
  measurement, not a physical-phone performance or battery benchmark.
