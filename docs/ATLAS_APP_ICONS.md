# Custom Atlas home-screen icons

Open **Control Room → App icons**, or **Atlas Apps → Customize home-screen icons**.
Select Atlas, Atlas Gallery, Atlas Music, Atlas Finance, Atlas Trips or Atlas Video.
Video must already be installed before its shortcut can be pinned.

Choose Signature, Light or Outline, one of six colors, and a soft square, circle
or square shape. Alternatively choose a JPEG, PNG or WebP under 15 MB, drag the
preview or adjust crop/zoom sliders. Set a name of 1–32 Unicode code points.
**Save icon** retains the design locally and asks Android to update existing Atlas
pinned shortcuts. **Add to home screen** saves and opens the launcher's pin prompt,
or updates the existing shortcut. **Restore original** resets the shortcut's icon
and name. It does not uninstall anything or delete photos.

## Android behavior

These are home-screen shortcuts, not changes to app-drawer or system Settings
icons. Android does not allow arbitrary user photos to replace those APK resources.
Existing default app icons remain available. A stock app icon already on the home
screen is separate from an Atlas-created custom shortcut; remove the stock icon
manually if both are visible. Stable IDs (`atlas-gallery`, `atlas-music`, etc.)
allow subsequent changes to target existing Atlas-created shortcuts.

Pinning needs Android 8+ and a compatible launcher. The launcher controls final
masking, badges, pin confirmation, name truncation and refresh timing. Some
launchers cache icons or ignore refreshes. No new launcher/overlay permissions,
background services or application-ID changes are introduced. Atlas Video remains
its own app; its shortcut is created by Atlas and launches the installed Video
package directly.

The main app and module shortcuts use the existing single-task activity and route
handoff. Cold launches select the fixed module route before React; warm launches
reuse the WebView/player. Existing optional authentication policies still apply.

## Local storage and image handling

`AtlasIcons` is a narrow Capacitor plugin. Native module allowlists prevent arbitrary
paths, packages and routes. Native label/design validation, PNG signature and IHDR
validation, exact 512px bounds, encoded/decoded size limits and actual bitmap
validation run before storing artwork. AtomicFile is used for PNG writes/reads.
Labels and the small validated design record use private preferences. Artwork is
stored under the app's no-backup directory, at most one image per module.

The editor reads at most 1 MiB of JPEG/PNG/WebP headers, handles JPEG orientation,
rejects unsafe dimensions and decodes a derivative with a maximum 1024px edge.
Only a 512px PNG, label and design choices cross the native bridge. Canvas and
native PNG re-encoding omit source EXIF. The original photo is unchanged and is
not retained or uploaded. ImageBitmaps are released on replacement/unmount, and
late image loads cannot replace a newer selection. The editor is lazy-loaded;
there are no idle animation loops or background scans.

Saved photos are already cropped derivatives. Choose the original photo again
when you need to recover content outside a previously saved crop. These settings
are local to the device; cloud recovery of custom icons is not implemented.

## Validation — 2026-11-27

- 646 unit tests passed. New coverage includes square crops, Unicode labels,
  header dimension limits, JPEG orientation and all three WebP dimension formats.
- TypeScript and scoped ESLint passed for the new editor, model and Apps entry.
- The platform-independent Java policy compiled and passed tests for module routes,
  label validation, design allowlists, PNG signature/size and 512px bounds.
- Chromium component fixture with a simulated Capacitor boundary passed preset,
  color, shape, custom photo, crop, label, save/pin/update/reset and saved-design
  restoration checks, including transparent circle corners. The generated 512px
  PNG had no EXIF metadata. Missing Video and web-preview fallback passed.
- Editor screenshots were captured and inspected at 390px and 1280px widths.
- Existing mobile launch and navigation source fixtures passed.

No APK, app bundle or production build was run. Full Android compilation and
physical-device launcher testing remain pending. In particular, native bitmap
processing, real pin confirmation, launcher refresh and the installed Video
handoff have not been verified on a phone. The native feature needs a future APK
update; an already installed APK cannot gain this plugin from source edits.

Screenshots: `work/qa-app-icons/icons-mobile.png` and `icons-desktop.png`.
Repeat source checks with `npm test`, `npx --no-install tsc --noEmit` and
`node tests/app-icons/browser.mjs`. Compile/run `AtlasIconPolicyCheck.java` against
`AtlasIconPolicy.java` for the native policy unit check without building an APK.
