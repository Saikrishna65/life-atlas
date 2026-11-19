# Private photo and video Gallery — Atlas 1.5.0

## Open and use

Update the existing Atlas Next app, then open **Private Atlas → Photo & video
gallery**. Grant full Android photo/video access to browse all accessible local
MediaStore media, or grant selected-photo access. The UI reports full, limited
or denied access; Permissions opens the app's Android settings. Nothing is
uploaded just because it appears in Gallery.

Select up to 100 files per Gallery batch using selection circles, touch long
press, desktop shift-range selection or Select loaded. **Add to trip / upload**
lets you choose/create a trip (including its map pin) and choose/create a place.
**Save selections only** stores durable native references without uploading.
**Save & upload originals** requires public-storage approval and one device
verification for the whole batch. Existing trip capacity remains 250 public media
items. Website review/publishing and the trip photo/video cover editor are also
available under **Trips & places → choose trip → website & cover controls**.

Encrypted private upload is separate and requires the existing verified recovery
setup. It never adds files to the website queue. Native WorkManager, multipart,
integrity verification, duplicate reuse, cancellation and retry behavior are
reused. No original file is resized, re-encoded, moved or deleted by Gallery.

## Implementation

- Native MediaStore metadata paging: 80 per page, stable timestamp/ID/volume
  cursors, bound search arguments, image/video/album filters, pending/trash
  exclusion and runtime permissions for older Android, Android 13 and Android 14+
  selected-photo access. No all-files storage permission.
- Stable selection IDs include MediaStore identity, size, modification time and MediaStore generation where available.
  Registration and upload preparation reject changed file versions. Content URIs
  stream through native storage; originals never pass through JavaScript memory.
- Windowed masonry for large libraries, four concurrent visible thumbnail
  requests, bounded native thumbnail cache, pinch/density controls, favorites,
  date/type/status/album filters and search. Initial browsing reads no full media.
- Original-image zoom, mobile swipe navigation, actual muted video autoplay with
  custom controls, details, public URL copying and original cloud downloads.
- Public/encrypted-private cloud listings have efficient pagination and explicitly
  labelled offline caches scoped to the actual configured bucket. Transfer
  history from another bucket cannot provide a false local-file status.
- Exact device-file hash checks against known native uploads distinguish not
  checked, no known match, verified/missing/unavailable copies and transfer state.
  Publication status requires an acknowledged website media ID; merely uploading
  or creating a public manifest is not considered website publication.
- Private cloud previews authenticate, verify encrypted bytes, decrypt with Tink
  into private temporary cache and return only a preview path. The authenticated
  object key is preserved. Cache is cleared on close/background and stale preview
  completion is discarded. No public selection or upload is created by preview.
- Phone browsing remains independent of cloud credentials, connectivity and a
  working R2 Keystore. Assignment/favorites/cache metadata use a separate local
  IndexedDB database; credentials and private plaintext hashes stay native.
- Lazy Gallery route in the bundled app; entry points on Private Atlas and Creator
  Studio. Public hero, globe and public layouts are unchanged.

## Validation

- TypeScript, scoped ESLint, production Next build with an isolated dummy database
  URL, mobile bundle and Capacitor sync; Android main/test Java compilation.
- Gallery status, bucket isolation, assignment persistence, publication
  acknowledgement, deterministic large masonry layout and existing upload tests.
- Native Robolectric tests cover permission policy, bounded query/pagination,
  read-only originals, versioned registrations, safe URI parsing, album metadata,
  Keystore-independent phone browsing, private preview cleanup, durable batch
  jobs with persisted native approval, pending retry reuse and recovery/selection failure atomicity.
- `node tests/gallery/gallery-browser.mjs` runs real Gallery components and real
  browser IndexedDB with synthetic native/API responses and existing repo assets.
  Exercises actual touch long press and swipes, video playback, private/public
  separation, assignment without upload, consent-gated batch, website publication
  and its confirmed status, favorites, filters, previews, cancellation, responsive
  layouts and bounded DOM for a synthetic 2,000-record library.
- Screenshots under ignored `work/qa-gallery/`. No personal cloud files are read,
  uploaded, published or deleted by tests. No generated photography is deployed.

## Limits

Physical Android 16 permissions, codecs, ContentProvider behavior and background
execution still require phone validation. MediaStore exposes accessible local
media, not every cloud-only Google Photos file or another app's private files.
Cloud checks use this installation's saved upload history and exact-byte matches;
unknown objects from elsewhere remain unconfirmed. Listings/filters operate on
loaded pages; server-backed phone search and paging continue as you scroll.
Private previews require network, restored keys and enough temporary storage;
unsupported browser formats can still be downloaded as originals. Android may
delay or stop background work, and revoking access can make queued sources
unavailable. No local original is deleted on failure.

## Further improvements

An encrypted shared library index for cross-device reconciliation; opt-in on-device
semantic search and smart albums; EXIF capture-date/map timelines; independently
recoverable Wi-Fi/charging album backups; and optional public video proxies plus
non-destructive edits while retaining encrypted/private originals.
