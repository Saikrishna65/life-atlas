# Atlas 2.2.9 — Gallery AI foundations

## Scope

Improve existing search, people grouping, similar-photo recommendations,
incremental indexing and encrypted recovery. No new model, service, training job,
public publishing change or automatic deletion. Original media stays untouched.

## Search

The first result page of up to 80 matches is cached encrypted in the existing
native database, for five minutes and at most sixteen queries. Keys include the
query, approved album scope, filters, settings epoch, model revision/readiness and
text/visual phase. Cache writes never advance index revisions. Every cached item
is checked against MediaStore access and its current file stamp; changed/deleted
sources cause a fresh scan. Cancellation remains effective. A failed cache does
not prevent ordinary search. Cache entries are derived and excluded from recovery.
Later pages and new queries still scan the saved index; this does not make an
unindexed library instantly searchable. Existing text-first/progressive search and
background-release of bounded decoded rows remain in place.

Natural search adds today/yesterday, Monday-based this/last week and the past
1–366 calendar days, combined with owner-confirmed people, unambiguous saved
places/trips, media type and remaining scene words. Unknown places are not guessed.

Visual rows must contain the current model revision and a 512-value embedding,
not just a completion flag. Old model rows are refreshed through serialized work;
existing current rows skip inference. No model weights change in this release.

## People and similar photos

People grouping processes clearer faces first. Poor unconfirmed detections cannot
serve as automatic anchors; lower-quality matches use stricter score/margin gates.
A poor named face is used as a reference only if the owner explicitly chose it.
Confirmed names never automatically absorb new faces. Existing merge/separate,
negative rules, aliases and explicit reference choices stay authoritative. Covers
prefer clearer faces unless the owner picked one. Collection policy versions
invalidate derived grouping caches without requiring new face inference.

Photo recommendations penalize heavily clipped exposure and break ties
consistently. The UI explains the recommendation and distinguishes near-identical
views from similar shots. Neither label asserts byte-identical duplicates. Saved
manual picks survive grouping and override the suggested cover. Nothing is deleted.

## Resources and recovery

Similar-only analysis decodes up to 512 pixels; visual-only work up to 768;
English OCR and face analysis retain the existing 1600-pixel target. Background
analysis/recovery waits on Battery Saver, moderate-or-higher thermal pressure
(API 29+), low memory, or battery at/below 20% while not charging. Existing
charging/storage/network constraints and serialized workers remain. New foreground
visual inference respects these gates; reading cached/text results remains usable.
Independent quality/OCR/visual failures preserve successful work and allow later
independent stages to proceed. Permission/cancellation/OCR timeout still stops
safely. Optional collection warmup cannot mark a completed scan as failed.
Incomplete passes get an honest status instead of “Up to date.”

Search-feedback and saved-edit writes now advance the revision used by encrypted
recovery. Those records were already exported by recovery, but their isolated
changes previously could fail to schedule an updated snapshot. Recovery still
requires explicit opt-in, the verified independent recovery kit and the approved
private bucket. No labels, identities, embeddings or OCR are copied into original
EXIF, public R2 metadata or the website catalog. No personal cloud operations were
performed during development.

## Validation and limits

Local and CI results, signed package identity and checksum are recorded below
when complete. Browser tests use fixture native calls; native tests execute Java
through Robolectric. No physical-phone accuracy, latency, temperature or battery
measurements are claimed. Visual/face inference analyzes photos, not entire movie
contents; existing video filename/date/trip/place browsing remains available.
Corrections are persisted personalization, not on-device model-weight training.
Android can defer jobs, and force-stop prevents background jobs until reopening.

## Phone acceptance

1. Update without uninstalling. Keep the existing models/index; leave charging-only
   enabled for initial or migration work. Allow the queued scan to finish.
2. Search for a known scene twice, then combine a saved place/person with “last
   week,” “yesterday,” or “past 7 days.” Check the interpreted filter labels.
3. Mark an irrelevant result, add a useful label, repeat the search, then reopen
   Atlas. Confirm the correction remains and affects matches.
4. Review a clear and a blurry face group, merge only after checking members, choose
   representative references, and verify a wrong-person separation stays separate.
5. Compare a burst including an overexposed shot. Choose your own pick; reopen the
   group and confirm it remains selected. No file should be removed.
6. Add a new photo and verify it queues analysis when Android constraints permit;
   already current photos should not repeat inference.
7. If recovery was already enabled with a verified kit, check that a correction
   marks it pending. Restoration must be tested separately with a safe test copy;
   development tests did not upload or restore any personal cloud data.
