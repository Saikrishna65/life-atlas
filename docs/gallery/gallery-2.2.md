# Gallery 2.2 — fast interaction and private personalization

## Viewer and browsing

Gesture state is an external motion store, with at most one DOM write per animation
frame. React renders gesture boundaries and controls rather than each finger move.
Pinch zoom follows the midpoint and clamps to the contained source image; double-tap zoom uses the tapped point. Double-tap then drag vertically provides quick
zoom. Normal-scale downward dragging fades the backdrop, shrinks media, hides
controls and returns toward the visible thumbnail. Offscreen thumbnails use a
fade; reduced motion skips travel. Return animation uses transforms rather than
layout-changing frame-by-frame size writes. Initial photos animate from their tile.

Grid pinch previews scale without rebuilding layout per move, then settles column
count with an anchored, short FLIP transition. Fingers apart enlarge tiles; fingers
together make the grid denser. Long-press/drag selection remains available.
Favourites opens as its own collection inside Collections, with native ID-based
paging instead of scanning unrelated library pages. Similar-photo review pages
reuse a bounded cache; “Use as best photo” changes the representative only.

Swipe up defaults to WhatsApp's recipient picker. More → Swipe-up shortcut can
choose WhatsApp, Share, Info or Add to trip when available. No gesture sends a file
to a recipient automatically.

## Search and corrections

Typing debounces for 350ms, invalidates stale results and cancels superseded native
searches. Permission-checked text matches appear before visual inference, with
bounded partial ranked batches while matching continues. Existing results stay
visible during refinement. Query inference remains isolated from the activity.
One completed model session can stay warm for 20 seconds; it is released when
idle, backgrounded or destroyed. Up to 32 encrypted query vectors avoid repeat
inference. No per-keystroke model training or background generative LLM is added.

More → Teach Atlas stores user descriptions and query relevance decisions in an
encrypted, source-version-bound choice record. Negative decisions override a
match for that normalized query; descriptions participate in text ranking. Face
merges/separations and place corrections continue to use their existing confirmed
rules. This is personalization, not fine-tuning weights. Reset is available per
photo; clearing analysis also clears these search corrections. Approved encrypted
AI recovery includes corrections and remaps them only to verified restored sources.

## Text and subject extraction

Long-press an accessible local photo, or choose More → Extract text or create
sticker. English ML Kit OCR provides selectable line boxes and copyable text, with
32 encrypted recent OCR results keyed by source version. OCR caches are derived
and are not added to the public catalog or recovery payload.

Subject extraction uses Google's optional Play-services Subject Segmentation SDK
16.0.0-beta1. First use requires explicit approval; compatible Google Play services
may download the model. It supports detectable foreground subjects and can fail
on complex images. This is not a universal arbitrary-object segmentation claim.
Decode is bounded to 1600px on its long edge, one extraction at a time; timeout
cleanup waits for native tasks before recycling their input. PNG cutouts preserve
transparency as separate derivatives. Copy/share/WhatsApp use temporary cache URI
grants; Save creates a PNG in Pictures/Atlas Stickers on Android 10+. Camera sources
are read-only. WhatsApp sharing is an image handoff, not a WhatsApp sticker-pack
installation. Cloud-only photos must first be accessible locally for extraction.

The gallery native guard is Android 8+, above Subject Segmentation's Android 7+
minimum. ML Kit auto-init is disabled on older SDKs; the manifest override preserves
the rest of Atlas's original minSdk without calling these APIs on older devices.

## Storage contract and migration

There is no bucket reset, object migration or automatic publishing.

- Private originals remain authenticated encrypted objects. Library metadata,
  place associations and AI recovery remain independently versioned encrypted
  sidecars under `encrypted/catalog/`.
- Public records gain optional `metadataVersion:1`, stable `assetId` and bounded
  category/collection `placements` with explicitly published place IDs/names. Existing v1 catalogs remain readable.
- Explicit re-publication creates a new immutable metadata revision; it does not
  overwrite old immutable records or rewrite image bytes.
- A verified existing public object can serve multiple trip/gallery placements.
  Native merges retain those relations; website trip selection honors them.
- Private IDs, labels, face names and AI corrections are not projected into the
  public catalog. The website still uses credential-free public URLs and lazy
  previews, with original objects kept separate.
- The reusable typed public registry groups approved public references by object
  key and rejects conflicting metadata; it never joins the private index.

## Validation limits

Unit/browser fixtures verify behavior and boundaries, not physical-phone frame
rates or Google model quality. Actual pinch/dismiss smoothness, cold/warm query
latency, segmentation availability, clipboard receiving apps, OCR accuracy and
Android update installation require phone validation. No personal cloud writes,
private-data reset or physical-device testing is performed by the test suite.
