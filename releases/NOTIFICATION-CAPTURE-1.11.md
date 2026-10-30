# Optional Kotak notification capture

Enable in Finance → Kotak Assistant → Capture & privacy, then grant Android notification access. Capture is off by default and filters to the two supported Kotak bank apps. SMS inbox and other apps are excluded. Captured transaction alerts stay in app-private SQLite; open Finance to process them. Ambiguous/unmapped alerts remain for review. Disable capture in the app and revoke access in Android settings to stop it fully. Pending queue files are excluded from Android cloud/device-transfer backup. Existing paste-alert and CSV import remain available.

Verified 255 application tests, two native filter tests, TypeScript, Android build and offline mobile browser flows. Live notification capture, background OS rebinding and Play Protect acceptance are unverified because no phone/emulator is attached.

This APK uses the same chat debug signing key. It cannot guarantee removal of a Play Protect warning. Keep Play Protect enabled; a false-positive review or a properly signed Play testing/distribution process may be needed. Do not uninstall the existing app to bypass a signing mismatch.
