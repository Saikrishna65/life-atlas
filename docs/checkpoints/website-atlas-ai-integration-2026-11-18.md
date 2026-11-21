# Website and Atlas AI integration checkpoint

This integration branch combines main at `5cabaa4662f1ec096fa9dd66bde746dca9e3b27d`
with `experiment/hey-atlas-phase3` at `e9b7731177d21c138a1f9e65f192f09c53a60ce3`.
It is a review checkpoint, not a production release or an installation fix.

## Preserved in the merge

- Current public website and Creator Studio collection/past-trip controls.
- Media-only trip publishing payload, optional itinerary, retained cloud routes/media.
- Native GPS fix filtering and corrected telemetry from main.
- Explicit preserved Android signing key configuration and certificate guards.
- The AI branch's private assistant, voice coordinator and wake-word code.
- Security gates introduced by the AI branch; none were bypassed.

The export-route conflict was resolved by retaining main's publishing implementation
and adding the AI branch's `sensitiveApiDenial` check before it.

## Production blockers

`src/lib/security/api-authorization.ts` intentionally denies every sensitive online
request. The merged API routes therefore return HTTP 403 for Creator Studio
publishing, trip export, cloud backup and other gated services. A real server
identity/owner-authorization integration is required before deploying this branch.
Do not remove these gates or deploy this branch as a working publishing update.
Local device unlock and app headers are not server authentication.

The installed Atlas AI APK has not been identified. Both code lines use
`com.lifeatlas.app` and preview `com.lifeatlas.app.next`. A source merge does not
make differently signed APKs compatible. Compare the actual working APK's
certificate/package and obtain Android's installation failure code before promising
an in-place update. Do not request private signing keys or uninstall stored data.
Version code remains 11 at this checkpoint; a later release must increment it.

## Validation performed

- TypeScript `tsc --noEmit`: passed.
- `npm test`: 418 tests passed, no failures/skips.
- APK update guard tests: 5 passed.
- Voice-assistant test file: 12 tests passed.
- Mobile bundle and Capacitor Android sync: passed.
- No unresolved merge conflicts; public page and GPS service have no changes
  relative to main from this merge.
- Offline Android assembly attempted; blocked at dependency resolution because
  `org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.25` is not cached. No combined APK,
  emulator, phone installation or production deployment was validated.
- No live cloud tests, migrations, personal-data uploads/restores or resets ran.

Native local language-model inference remains subject to the AI branch's existing
runtime/model limitations; merging source does not complete that implementation.
