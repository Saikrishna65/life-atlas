# Atlas 2.1.0 — unified Android test release

## Source integration

Combines the current public website/Gallery main line (`a136dfb`) with the reviewed
integration checkpoint `5850915`. That checkpoint contains the current remote
`experiment/hey-atlas-phase3` head `e9b7731` and its wake-word predecessor
`6bd6561`; neither remote experiment branch had newer commits at audit time.

Merge resolutions retain the latest trip cover/publication implementation and its
server security gates, current Gallery native libraries/tests, isolated search
process, Kotlin voice plugin, and ONNX 1.23.2 shared by Gallery and wake-word.
There is one ONNX dependency, not simultaneous competing versions.
Public landing-page hero and globe code are untouched.

## App identity

The visible name is **Atlas** with an **Atlas Gallery** second launcher alias.
The delivered `atlas.apk` retains `com.lifeatlas.app.next`, version code 35,
version 2.1.0 and the preserved signing key, so existing Next data survives an
in-place update. The `.next` suffix is a historical Android identifier, not a
second product. Do not change it in later releases. The old `.app` identity is
built only as a compatibility artifact for existing legacy installations and is
not a shared database or automatic migration path. There is no reset.

## Updates

Control Room → Access → App updates opens the update panel. A native Capacitor
plugin checks public GitHub releases at most once a day when the app is opened;
this is not a persistent background polling service. Manual checks are available.
The checked feed/asset hosts are fixed in native code. JavaScript cannot supply
URLs, hashes or arbitrary install paths. Each eligible release publishes a small
versioned `atlas-update.json` derived from verified APKs in the signed build job.
Fresh-install-only builds publish no eligible packages.

Download is explicit and Wi-Fi-only by default. Transfers stream natively into a
bounded temporary cache with progress/cancel/retry. Size, SHA-256, increasing
version, actual APK package and installed signing certificate must all match.
The verified file is checked again before Android's installer receives a temporary
read grant. Android requires permission to install from Atlas and user approval;
there is no silent installation or APK execution by the WebView. Later suppresses
that version's reminder. Checks/download errors never block ordinary app use.
Process termination can interrupt downloading; retry starts a fresh download.

## AI capabilities and retained limits

The integrated assistant, encrypted conversations/memory, local action registry,
planner, foreground voice, opt-in wake-word and voice settings are present.
The branch's existing offline LLM runtime/model catalogue is unfinished and stays
unavailable; this integration does not claim local generative inference. Configured
cloud providers require the user's key and consent. Microphone/assistant-role
permissions and wake-word survival still need actual phone testing.

Sensitive hosted APIs intentionally fail closed until genuine server owner
authentication exists. This affects the older hosted music/cloud/Studio routes;
it does not authorize those routes using an app header or local biometric unlock.
The modern direct native R2 flow remains separate. Existing online-service limits
are not removed to make a merge appear complete.

## Validation and phone checklist

Run TypeScript, scoped lint, full TypeScript tests, updater-manifest/signing tests,
AI and Gallery browser regressions, the updater browser fixture, mobile bundle,
production website build and native debug/preview tests before distribution.

On the phone: update without uninstalling; open both launcher icons; verify shared
Gallery/trip/cloud state; check Smart Search; open assistant and test opt-in voice;
exercise upload and publication using only explicitly selected media. In Updates,
check Wi-Fi preferences, Later and Android's install-permission handoff when a
newer signed version exists. No personal cloud operations are run by build tests.
A same-version release should not be offered as an update. Full update installation
requires a later version and physical-device verification.
