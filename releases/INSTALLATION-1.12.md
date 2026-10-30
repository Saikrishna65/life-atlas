# Life Atlas 1.12

Automatic notification capture has been removed from this APK after the reported Play Protect installation block. The built manifest has no notification-listener service or SMS-reading permission; the listener implementation is not compiled into its DEX files. Manual paste-alert entry, statement import, music playback and existing data remain supported. Ordinary permission to display the app's own notifications is separate from reading other apps' notifications.

Verified 255 application tests, TypeScript, Android build, offline mobile browser flows and inspection of the final APK manifest/DEX. Play Protect approval and actual installation on the user's phone remain unverified. Keep Play Protect enabled; do not uninstall or clear the existing app to bypass signing problems. The signing identity and package match earlier chat builds.

Automatic notification capture requires a separately reviewed distribution/signing path rather than a promise that another sideloaded APK will bypass the block.
