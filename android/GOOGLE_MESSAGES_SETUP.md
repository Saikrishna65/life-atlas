# Automatic bank messages

The Android `KotakNotificationTracker` plugin captures **new Kotak transaction notifications from Google Messages** (`com.google.android.apps.messaging`). It does not read SMS history and does not require READ_SMS or RECEIVE_SMS.

## Ship and enable

Both the web changes and a rebuilt Android APK are required. The Capacitor shell loads the Vercel URL in `capacitor.config.ts`; installing an APK alone does not deploy the web controls.

1. Build/install the updated APK using the existing signing identity. Do not replace the signing key.
2. In Atlas Finance, add a Kotak bank/savings account with the correct last four digits.
3. Open **Import message → Automatic → Enable automatic capture**.
4. In Android notification access settings, enable **Atlas bank alerts (Google Messages)**. On Android versions that restrict sideloaded app settings, the user may first need to allow restricted settings from App info.
5. Enable transaction notifications with message previews in Google Messages. Test with a new, genuine Kotak transaction alert.
6. Open/return to Finance to import the queued alert. Every transaction goes to Review with a suggested category. Select or correct the account and category, then approve to record it.

Capture is off by default and can be disabled in the Automatic tab. Android's notification access permission is broad, but this implementation filters Google Messages/Kotak transaction alerts before persisting. OTPs, unrelated apps, summaries, and non-transaction messages are ignored. Queue storage is private to the app and excluded from Android cloud backups and device transfer.

The OS notification listener captures while the web screen is closed; the TypeScript ledger records only explicitly approved items while Finance is open. Force-stopping the Android app, disabling notification access, hidden notification content, or OEM restrictions can prevent capture. Existing inbox messages are never backfilled. The queue has a 1,000-event limit and reports a status error when full; open Finance regularly to drain it. Capture does not connect to Google's servers.

## Verification

TypeScript: `npx tsc --noEmit`.

Run individual finance test files with `node --import tsx tests/finance/googleMessages.test.ts` (this executes the nested tests with the installed Node/tsx combination).

The native pre-persistence filter has a plain Java test in `app/src/test/java/com/lifeatlas/app/BankAlertFilterTest.java`. Compile it together with `BankAlertFilter.java`, then run its main method.

Full Android verification requires Android SDK 34, the configured Gradle toolchain, and a physical device/emulator with Google Messages. Build with `./gradlew :app:assembleDebug` from this directory. Test permission denial/revocation, reopen after capture, notification updates, duplicate alerts, and stop/start capture on the device. An automated JVM filter test does not validate Android's listener lifecycle.

The updated app can post an Atlas notification for each captured bank alert. Grant Android notification permission in addition to notification-listener access. Tapping the notification opens the approval inbox. The Finance card in Private Atlas displays the unique pending-transaction count. No approval is performed by the notification itself.

## Updating an installed APK

Keep the established signing identity for updates. The approval-update workflow prepares unsigned APK contents in CI and uses detached signatures from the retained key in the private workspace. It verifies both Android JAR (v1) and APK (v2) signatures before publishing the final APK. Do not distribute the temporary Gradle debug APK, which uses a temporary build key. Keep the encrypted signing backup and the workspace’s private recovery key.
