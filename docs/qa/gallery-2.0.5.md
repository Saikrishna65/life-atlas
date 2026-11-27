# Gallery 2.0.5 update

## Installed-app checks

Install `atlas-next.apk` over the existing Atlas installation. Do not uninstall
or clear app data. Package: `com.lifeatlas.app.next`; version code 34.

1. Open Gallery → Search → Smart Search. Type a query, then submit it. Typing
   alone must not start text-model inference. Repeat several searches, including
   people/date/place filters. Check that the app stays open. The text encoder now
   runs in a non-exported, separate Android process, uses a bounded encrypted query
   cache and falls back to ordinary search if inference fails or memory is low.
2. Open a photo with one tap. Swipe between photos and videos: there is an 18px
   gap, and only the selected video plays. Pinch/pan still work. Drag down slowly:
   controls hide, the media shrinks and the backdrop reveals the gallery. Release
   past the threshold to close toward its visible thumbnail. Offscreen thumbnails
   use a fade; reduced motion skips the travel animation.
3. Swipe up to open WhatsApp's recipient picker. Nothing is sent automatically.
   Ordinary Share remains available in the controls. Test a phone with WhatsApp,
   WhatsApp Business and neither installed when possible.
4. Open Info and More. Both use the same centred panel design. Back closes the
   current panel before the viewer. Test Android hardware Back as well as buttons.
5. Edit a photo and save a copy. Check crop, rotation, straighten, brightness and
   contrast. The original remains unchanged and can be opened from the copy's
   More menu. Export is a separate JPEG, at most 3072px / 6MP, not an original-byte
   or HDR-preserving edit.
6. Pause a local video, close it and reopen it to test saved position. Open its
   frame strip; seek and choose a cover. Check unsupported codecs return a clear
   error. Browser/device codec support still determines playback.
7. Review familiar faces: move selected faces, confirm reference photos, merge
   groups and reject a proposed match. Names and corrections remain owner-approved;
   grouping is still fallible. Hiding an album does not lock or delete its photos.
8. For a supported Motion Photo, play its embedded clip. Review any same-folder
   companion suggestion before choosing to share or assign both. Supported formats
   include Google XMP offsets and compatible same-base-name companions, not every
   proprietary motion format. Large embedded clips are bounded.
9. Try a location-free sharing copy and verify it independently. Still copies
   strip EXIF; supported videos are remuxed without location metadata or transcoding.
   Visible content can still reveal a location. Originals are never modified.
10. Open Gallery settings: inspect actual cache use, change its limit, clear
    rebuildable previews, review largest local files, and inspect/pause analysis.
    Cache clearing must not touch originals, pending edits or recovery material.
11. Rehearse an already-created recovery kit with its passphrase. This verifies
    it against the active key with an authenticated synthetic round trip; it does
    not replace the key, restore cloud data or upload personal media.

## Engineering validation

- TypeScript, scoped ESLint, production website build and mobile bundle passed.
- 72 targeted TypeScript tests and 5 signing/update checks passed locally.
- Gallery, Places and Library Chromium flows passed with synthetic native/cloud
  responses. Gallery also passed with normal animations and reduced motion.
- Android debug/preview native unit tests and signed APK assemblies passed in
  install-update workflow run `44892450261`. This job skips live-cloud checks.
- Release source: `795e13ec772b111d36e6bc0897b775a5e944d140`.
- Downloaded Next APK SHA-256:
  `131259c88fa57f3e134beb59b9d20a2abc1f4049c968dca5eb73abcabdd327d5`.
- APK certificate SHA-256:
  `2f19571f9d6a4a3b4c7250397b7618f04e047beeeaa0023713e2a6c0a745af7d`.

No physical-phone, WhatsApp installation, real camera codec, battery/thermal or
reported crash reproduction is claimed. There was no phone crash stack trace;
process isolation addresses the suspected native inference failure, with fallback
and memory limits, rather than claiming every cause of Android shutdown is fixed.
No personal cloud files were uploaded, deleted or restored in this validation.
