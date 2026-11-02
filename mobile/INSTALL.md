Atlas Vault — offline and online Android test build

1. Download atlas-offline-online.zip from this GitHub release and extract it.
2. If Android reports a signature conflict, uninstall the previous Atlas app first. Uninstalling removes its local data.
3. Install atlas-offline-online.apk and allow installation from your browser/file manager when Android asks.
4. On first launch this clean test build initializes empty local Trip Vault, Music, Finance, Studio and Control Room databases. New test data persists after relaunch.
5. Test in airplane mode: trips and all trip subsections, local documents, imported music/playlists, manual finance and statement imports, Studio drafts, local storage inspection and encrypted backups.
6. Reconnect to the internet to use the hosted Atlas APIs for YouTube, music cloud storage/sync, AI (if configured), Control Room cloud management and Studio publishing. Studio drafts stay on the device and retry publishing when connectivity returns. Imported songs and saved documents remain usable offline.
7. For bank-alert capture, grant Atlas notification access in Android settings and enable tracking. Only supported Google Messages/Kotak notifications are captured; historical SMS are not read. Allow notification permission for reminder and finance-review alerts.
8. Map directions open the device's map service and require the map service's own connectivity/offline downloads.

This APK is built from the current Android sources, including the bank-alert plugin. Browser automation checks the bundled screens and online API routing. Device-specific media background behavior, widgets, permissions and live external services still require testing on your phone. A working internet connection does not replace missing server credentials, storage permissions or external-service availability.

The ZIP includes service-health.json with the hosted service probe results at build time. Finance's ledger sync adapter is not configured; use Control Room's encrypted backups for cloud backup of finance data.

Exports and downloaded files open Android's document picker. Choose a destination on your device to save offline documents, playlists, and encrypted backup files. Cloud-file links keep working after file operations in Control Room.
