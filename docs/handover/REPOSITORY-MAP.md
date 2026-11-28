# Atlas repository map

Generated from tracked source layout on 28 November 2026. This is a navigation index, not a claim that every route is enabled or device-tested. Links are relative to this file. See [Start here](START-HERE.md) for status and constraints.

## Top-level paths

| Path | Purpose |
| --- | --- |
| [`src/app`](../../src/app) | Next pages and server API handlers |
| [`src/components`](../../src/components) | React user interfaces |
| [`src/lib`](../../src/lib) | Domain logic, native bridges, queries and caches |
| [`mobile`](../../mobile) | Offline app entry, routing and Next adapters |
| [`android`](../../android) | Native Atlas project, plugins, services, JNI and tests |
| [`prisma`](../../prisma) | Server schema and migrations |
| [`public`](../../public) | Public static assets, logos and local fonts |
| [`tests`](../../tests) | TypeScript tests and browser fixture scripts |
| [`scripts`](../../scripts) | Build, release and QA utilities; inspect before execution |
| [`.github/workflows`](../../.github/workflows) | CI definitions; several build APKs |
| [`docs`](../../docs) | Module guides, historical validation and handover |

## Feature entry points

| Area | Source |
| --- | --- |
| Homepage | [`src/app/page.tsx`](../../src/app/page.tsx) |
| Public scene composition | [`src/components/world/LivingWorld.tsx`](../../src/components/world/LivingWorld.tsx) |
| Trip film hero | [`src/components/home/TripFilmHero.tsx`](../../src/components/home/TripFilmHero.tsx) |
| Trip detail | [`src/app/trips/[slug]/page.tsx`](../../src/app/trips/[slug]/page.tsx) |
| Control Room | [`src/components/control-room/ControlRoom.tsx`](../../src/components/control-room/ControlRoom.tsx) |
| Account recovery page | [`src/app/secret/account/page.tsx`](../../src/app/secret/account/page.tsx) |
| Account server boundary | [`src/app/api/account/[action]/route.ts`](../../src/app/api/account/[action]/route.ts) |
| Quarantined legacy API policy | [`src/lib/security/api-authorization.ts`](../../src/lib/security/api-authorization.ts) |
| Optional device auth | [`src/lib/security/authentication.ts`](../../src/lib/security/authentication.ts) |
| Native gallery bridge | [`src/lib/r2/native.ts`](../../src/lib/r2/native.ts) |
| Gallery UI | [`src/components/gallery`](../../src/components/gallery) |
| Gallery state/motion/search | [`src/lib/gallery`](../../src/lib/gallery) |
| Creator Studio | [`src/lib/studio`](../../src/lib/studio) |
| Public data queries | [`src/lib/queries`](../../src/lib/queries) |
| Private Trips | [`src/lib/vault`](../../src/lib/vault) |
| Finance domain/services | [`src/lib/finance`](../../src/lib/finance) |
| Music player | [`src/lib/music/MusicPlayerContext.tsx`](../../src/lib/music/MusicPlayerContext.tsx) |
| Atlas AI | [`src/lib/atlas-ai`](../../src/lib/atlas-ai) |
| Model Lab | [`src/components/intelligence-lab`](../../src/components/intelligence-lab) |
| Video services | [`src/lib/video`](../../src/lib/video) |
| Companion apps | [`src/lib/companion-apps`](../../src/lib/companion-apps) |
| App updates | [`src/lib/updates`](../../src/lib/updates) |
| Performance helpers | [`src/lib/performance`](../../src/lib/performance) |
| Offline route registry | [`mobile/App.tsx`](../../mobile/App.tsx) |
| Native registration | [`android/app/src/main/java/com/lifeatlas/app/MainActivity.java`](../../android/app/src/main/java/com/lifeatlas/app/MainActivity.java) |

## Page routes

These are source routes. Android needs a matching entry in `mobile/App.tsx`; server APIs do not run in the offline bundle. Dynamic IDs are placeholders.

- `/about` — [source](../../src/app/about/page.tsx)
- `/admin` — [source](../../src/app/admin/page.tsx)
- `/admin/trips/new` — [source](../../src/app/admin/trips/new/page.tsx)
- `/cinema` — [source](../../src/app/cinema/page.tsx)
- `/experiences` — [source](../../src/app/experiences/page.tsx)
- `/explore` — [source](../../src/app/explore/page.tsx)
- `/food` — [source](../../src/app/food/page.tsx)
- `/map` — [source](../../src/app/map/page.tsx)
- `/` — [source](../../src/app/page.tsx)
- `/photography` — [source](../../src/app/photography/page.tsx)
- `/places/[slug]` — [source](../../src/app/places/[slug]/page.tsx)
- `/places` — [source](../../src/app/places/page.tsx)
- `/search` — [source](../../src/app/search/page.tsx)
- `/secret/account` — [source](../../src/app/secret/account/page.tsx)
- `/secret/apps` — [source](../../src/app/secret/apps/page.tsx)
- `/secret/atlas` — [source](../../src/app/secret/atlas/page.tsx)
- `/secret/control-room/experiments/hey-atlas` — [source](../../src/app/secret/control-room/experiments/hey-atlas/page.tsx)
- `/secret/control-room/intelligence` — [source](../../src/app/secret/control-room/intelligence/page.tsx)
- `/secret/control-room` — [source](../../src/app/secret/control-room/page.tsx)
- `/secret/finance` — [source](../../src/app/secret/finance/page.tsx)
- `/secret/finance/review` — [source](../../src/app/secret/finance/review/page.tsx)
- `/secret/finance/shared` — [source](../../src/app/secret/finance/shared/page.tsx)
- `/secret/gallery/library` — [source](../../src/app/secret/gallery/library/page.tsx)
- `/secret/gallery` — [source](../../src/app/secret/gallery/page.tsx)
- `/secret/music/albums` — [source](../../src/app/secret/music/albums/page.tsx)
- `/secret/music/artists` — [source](../../src/app/secret/music/artists/page.tsx)
- `/secret/music/downloads` — [source](../../src/app/secret/music/downloads/page.tsx)
- `/secret/music/library` — [source](../../src/app/secret/music/library/page.tsx)
- `/secret/music` — [source](../../src/app/secret/music/page.tsx)
- `/secret/music/playlists/[playlistId]` — [source](../../src/app/secret/music/playlists/[playlistId]/page.tsx)
- `/secret/music/playlists` — [source](../../src/app/secret/music/playlists/page.tsx)
- `/secret/music/queue` — [source](../../src/app/secret/music/queue/page.tsx)
- `/secret/music/settings` — [source](../../src/app/secret/music/settings/page.tsx)
- `/secret` — [source](../../src/app/secret/page.tsx)
- `/secret/studio` — [source](../../src/app/secret/studio/page.tsx)
- `/secret/vault/[tripId]/assistant` — [source](../../src/app/secret/vault/[tripId]/assistant/page.tsx)
- `/secret/vault/[tripId]/bookings` — [source](../../src/app/secret/vault/[tripId]/bookings/page.tsx)
- `/secret/vault/[tripId]/budget` — [source](../../src/app/secret/vault/[tripId]/budget/page.tsx)
- `/secret/vault/[tripId]/checklist` — [source](../../src/app/secret/vault/[tripId]/checklist/page.tsx)
- `/secret/vault/[tripId]/documents` — [source](../../src/app/secret/vault/[tripId]/documents/page.tsx)
- `/secret/vault/[tripId]/food` — [source](../../src/app/secret/vault/[tripId]/food/page.tsx)
- `/secret/vault/[tripId]/itinerary` — [source](../../src/app/secret/vault/[tripId]/itinerary/page.tsx)
- `/secret/vault/[tripId]/memories` — [source](../../src/app/secret/vault/[tripId]/memories/page.tsx)
- `/secret/vault/[tripId]/money` — [source](../../src/app/secret/vault/[tripId]/money/page.tsx)
- `/secret/vault/[tripId]/packing` — [source](../../src/app/secret/vault/[tripId]/packing/page.tsx)
- `/secret/vault/[tripId]` — [source](../../src/app/secret/vault/[tripId]/page.tsx)
- `/secret/vault/[tripId]/plan` — [source](../../src/app/secret/vault/[tripId]/plan/page.tsx)
- `/secret/vault/[tripId]/reminders` — [source](../../src/app/secret/vault/[tripId]/reminders/page.tsx)
- `/secret/vault/[tripId]/rentals` — [source](../../src/app/secret/vault/[tripId]/rentals/page.tsx)
- `/secret/vault/[tripId]/routes` — [source](../../src/app/secret/vault/[tripId]/routes/page.tsx)
- `/secret/vault/[tripId]/safety` — [source](../../src/app/secret/vault/[tripId]/safety/page.tsx)
- `/secret/vault/new` — [source](../../src/app/secret/vault/new/page.tsx)
- `/secret/vault` — [source](../../src/app/secret/vault/page.tsx)
- `/secret/video` — [source](../../src/app/secret/video/page.tsx)
- `/timeline` — [source](../../src/app/timeline/page.tsx)
- `/trips/[slug]` — [source](../../src/app/trips/[slug]/page.tsx)
- `/trips` — [source](../../src/app/trips/page.tsx)
- `/video` — [source](../../src/app/video/page.tsx)

## API and other route handlers

Presence does not imply permission. Read each authorization guard before using a mutation.

- `/api/account/[action]` — [source](../../src/app/api/account/[action]/route.ts)
- `/api/admin/android-signing` — [source](../../src/app/api/admin/android-signing/route.ts)
- `/api/admin/test-data-reset` — [source](../../src/app/api/admin/test-data-reset/route.ts)
- `/api/apps/catalog` — [source](../../src/app/api/apps/catalog/route.ts)
- `/api/cloud-vault` — [source](../../src/app/api/cloud-vault/route.ts)
- `/api/control-room/file` — [source](../../src/app/api/control-room/file/route.ts)
- `/api/control-room` — [source](../../src/app/api/control-room/route.ts)
- `/api/mobile/studio` — [source](../../src/app/api/mobile/studio/route.ts)
- `/api/music` — [source](../../src/app/api/music/route.ts)
- `/api/music/stream/[id]` — [source](../../src/app/api/music/stream/[id]/route.ts)
- `/api/music/upload-url` — [source](../../src/app/api/music/upload-url/route.ts)
- `/api/music/youtube` — [source](../../src/app/api/music/youtube/route.ts)
- `/api/public/studio-photo/[id]` — [source](../../src/app/api/public/studio-photo/[id]/route.ts)
- `/api/search` — [source](../../src/app/api/search/route.ts)
- `/api/studio/website` — [source](../../src/app/api/studio/website/route.ts)
- `/api/upload` — [source](../../src/app/api/upload/route.ts)
- `/api/vault/ai/itinerary` — [source](../../src/app/api/vault/ai/itinerary/route.ts)
- `/api/vault/ai/parse` — [source](../../src/app/api/vault/ai/parse/route.ts)
- `/api/vault/export` — [source](../../src/app/api/vault/export/route.ts)
- `/api/video/channel` — [source](../../src/app/api/video/channel/route.ts)
- `/api/video/search` — [source](../../src/app/api/video/search/route.ts)
- `/api/video/suggestions` — [source](../../src/app/api/video/suggestions/route.ts)
- `/cloud-recovery` — [source](../../src/app/cloud-recovery/route.ts)

## Native source inventory

Grouped by package. Most media and Gallery modules share the historical `r2` package; their names do not mean every action accesses cloud storage.

### `app root`

- [AtlasAppsPlugin.java](../../android/app/src/main/java/com/lifeatlas/app/AtlasAppsPlugin.java)
- [AtlasCompanionPolicy.java](../../android/app/src/main/java/com/lifeatlas/app/AtlasCompanionPolicy.java)
- [AtlasFileExportPlugin.java](../../android/app/src/main/java/com/lifeatlas/app/AtlasFileExportPlugin.java)
- [AtlasIconPolicy.java](../../android/app/src/main/java/com/lifeatlas/app/AtlasIconPolicy.java)
- [AtlasIconStore.java](../../android/app/src/main/java/com/lifeatlas/app/AtlasIconStore.java)
- [AtlasIconsPlugin.java](../../android/app/src/main/java/com/lifeatlas/app/AtlasIconsPlugin.java)
- [AtlasKeyWrapper.java](../../android/app/src/main/java/com/lifeatlas/app/AtlasKeyWrapper.java)
- [AtlasLocalAIPlugin.java](../../android/app/src/main/java/com/lifeatlas/app/AtlasLocalAIPlugin.java)
- [AtlasModelTransfer.java](../../android/app/src/main/java/com/lifeatlas/app/AtlasModelTransfer.java)
- [AtlasModelsPlugin.java](../../android/app/src/main/java/com/lifeatlas/app/AtlasModelsPlugin.java)
- [AtlasPermissionsPlugin.java](../../android/app/src/main/java/com/lifeatlas/app/AtlasPermissionsPlugin.java)
- [AtlasUpdatePolicy.java](../../android/app/src/main/java/com/lifeatlas/app/AtlasUpdatePolicy.java)
- [AtlasUpdatesPlugin.java](../../android/app/src/main/java/com/lifeatlas/app/AtlasUpdatesPlugin.java)
- [AtlasWebView.java](../../android/app/src/main/java/com/lifeatlas/app/AtlasWebView.java)
- [BankAlertFilter.java](../../android/app/src/main/java/com/lifeatlas/app/BankAlertFilter.java)
- [BankNotificationListener.java](../../android/app/src/main/java/com/lifeatlas/app/BankNotificationListener.java)
- [BankNotificationStore.java](../../android/app/src/main/java/com/lifeatlas/app/BankNotificationStore.java)
- [ExpeditionFixFilter.java](../../android/app/src/main/java/com/lifeatlas/app/ExpeditionFixFilter.java)
- [ExpeditionTrackingPlugin.java](../../android/app/src/main/java/com/lifeatlas/app/ExpeditionTrackingPlugin.java)
- [ExpeditionTrackingService.java](../../android/app/src/main/java/com/lifeatlas/app/ExpeditionTrackingService.java)
- [FinanceAppWidgetProvider.java](../../android/app/src/main/java/com/lifeatlas/app/FinanceAppWidgetProvider.java)
- [FinanceReviewNotifications.java](../../android/app/src/main/java/com/lifeatlas/app/FinanceReviewNotifications.java)
- [KotakNotificationTrackerPlugin.java](../../android/app/src/main/java/com/lifeatlas/app/KotakNotificationTrackerPlugin.java)
- [LaunchRoutes.java](../../android/app/src/main/java/com/lifeatlas/app/LaunchRoutes.java)
- [MainActivity.java](../../android/app/src/main/java/com/lifeatlas/app/MainActivity.java)
- [MediaPlaybackPlugin.java](../../android/app/src/main/java/com/lifeatlas/app/MediaPlaybackPlugin.java)
- [MediaPlaybackService.java](../../android/app/src/main/java/com/lifeatlas/app/MediaPlaybackService.java)
- [MusicAppWidgetProvider.java](../../android/app/src/main/java/com/lifeatlas/app/MusicAppWidgetProvider.java)
- [TripAppWidgetProvider.java](../../android/app/src/main/java/com/lifeatlas/app/TripAppWidgetProvider.java)

### `ai`

- [AtlasDownloadRules.java](../../android/app/src/main/java/com/lifeatlas/app/ai/AtlasDownloadRules.java)
- [AtlasInferenceRuntime.java](../../android/app/src/main/java/com/lifeatlas/app/ai/AtlasInferenceRuntime.java)
- [AtlasLabHistory.java](../../android/app/src/main/java/com/lifeatlas/app/ai/AtlasLabHistory.java)
- [AtlasLlamaNative.java](../../android/app/src/main/java/com/lifeatlas/app/ai/AtlasLlamaNative.java)
- [AtlasModelDownloadService.java](../../android/app/src/main/java/com/lifeatlas/app/ai/AtlasModelDownloadService.java)
- [AtlasModelStore.java](../../android/app/src/main/java/com/lifeatlas/app/ai/AtlasModelStore.java)
- [AtlasSpeechGate.java](../../android/app/src/main/java/com/lifeatlas/app/ai/AtlasSpeechGate.java)
- [AtlasVoiceLatencyTrace.java](../../android/app/src/main/java/com/lifeatlas/app/ai/AtlasVoiceLatencyTrace.java)

### `r2`

- [GalleryAiBudget.java](../../android/app/src/main/java/com/lifeatlas/app/r2/GalleryAiBudget.java)
- [GalleryAlbums.java](../../android/app/src/main/java/com/lifeatlas/app/r2/GalleryAlbums.java)
- [GalleryAnalysisHealth.java](../../android/app/src/main/java/com/lifeatlas/app/r2/GalleryAnalysisHealth.java)
- [GalleryClip.java](../../android/app/src/main/java/com/lifeatlas/app/r2/GalleryClip.java)
- [GalleryClipTokenizer.java](../../android/app/src/main/java/com/lifeatlas/app/r2/GalleryClipTokenizer.java)
- [GalleryCollections.java](../../android/app/src/main/java/com/lifeatlas/app/r2/GalleryCollections.java)
- [GalleryCorrections.java](../../android/app/src/main/java/com/lifeatlas/app/r2/GalleryCorrections.java)
- [GalleryEditGeometry.java](../../android/app/src/main/java/com/lifeatlas/app/r2/GalleryEditGeometry.java)
- [GalleryExtraction.java](../../android/app/src/main/java/com/lifeatlas/app/r2/GalleryExtraction.java)
- [GalleryExtractionService.java](../../android/app/src/main/java/com/lifeatlas/app/r2/GalleryExtractionService.java)
- [GalleryFaceModels.java](../../android/app/src/main/java/com/lifeatlas/app/r2/GalleryFaceModels.java)
- [GalleryFaceQuality.java](../../android/app/src/main/java/com/lifeatlas/app/r2/GalleryFaceQuality.java)
- [GalleryIndexedPhotos.java](../../android/app/src/main/java/com/lifeatlas/app/r2/GalleryIndexedPhotos.java)
- [GalleryIntelligence.java](../../android/app/src/main/java/com/lifeatlas/app/r2/GalleryIntelligence.java)
- [GalleryIntelligenceWorker.java](../../android/app/src/main/java/com/lifeatlas/app/r2/GalleryIntelligenceWorker.java)
- [GalleryMediaActions.java](../../android/app/src/main/java/com/lifeatlas/app/r2/GalleryMediaActions.java)
- [GalleryMediaTools.java](../../android/app/src/main/java/com/lifeatlas/app/r2/GalleryMediaTools.java)
- [GalleryMotionPhoto.java](../../android/app/src/main/java/com/lifeatlas/app/r2/GalleryMotionPhoto.java)
- [GalleryNativeViewerActivity.java](../../android/app/src/main/java/com/lifeatlas/app/r2/GalleryNativeViewerActivity.java)
- [GalleryPeople.java](../../android/app/src/main/java/com/lifeatlas/app/r2/GalleryPeople.java)
- [GalleryPhotoQuality.java](../../android/app/src/main/java/com/lifeatlas/app/r2/GalleryPhotoQuality.java)
- [GalleryPreviewSettings.java](../../android/app/src/main/java/com/lifeatlas/app/r2/GalleryPreviewSettings.java)
- [GalleryRecovery.java](../../android/app/src/main/java/com/lifeatlas/app/r2/GalleryRecovery.java)
- [GalleryRecoveryWorker.java](../../android/app/src/main/java/com/lifeatlas/app/r2/GalleryRecoveryWorker.java)
- [GallerySearchHotCache.java](../../android/app/src/main/java/com/lifeatlas/app/r2/GallerySearchHotCache.java)
- [GallerySearchInference.java](../../android/app/src/main/java/com/lifeatlas/app/r2/GallerySearchInference.java)
- [GallerySearchResults.java](../../android/app/src/main/java/com/lifeatlas/app/r2/GallerySearchResults.java)
- [GallerySearchService.java](../../android/app/src/main/java/com/lifeatlas/app/r2/GallerySearchService.java)
- [GallerySearchStore.java](../../android/app/src/main/java/com/lifeatlas/app/r2/GallerySearchStore.java)
- [GallerySimilar.java](../../android/app/src/main/java/com/lifeatlas/app/r2/GallerySimilar.java)
- [GallerySmartAlbums.java](../../android/app/src/main/java/com/lifeatlas/app/r2/GallerySmartAlbums.java)
- [GallerySpace.java](../../android/app/src/main/java/com/lifeatlas/app/r2/GallerySpace.java)
- [GallerySubjectInference.java](../../android/app/src/main/java/com/lifeatlas/app/r2/GallerySubjectInference.java)
- [GalleryWatchWorker.java](../../android/app/src/main/java/com/lifeatlas/app/r2/GalleryWatchWorker.java)
- [R2AutoBackup.java](../../android/app/src/main/java/com/lifeatlas/app/r2/R2AutoBackup.java)
- [R2AutoBackupWorker.java](../../android/app/src/main/java/com/lifeatlas/app/r2/R2AutoBackupWorker.java)
- [R2Catalog.java](../../android/app/src/main/java/com/lifeatlas/app/r2/R2Catalog.java)
- [R2Client.java](../../android/app/src/main/java/com/lifeatlas/app/r2/R2Client.java)
- [R2Credentials.java](../../android/app/src/main/java/com/lifeatlas/app/r2/R2Credentials.java)
- [R2Crypto.java](../../android/app/src/main/java/com/lifeatlas/app/r2/R2Crypto.java)
- [R2DeviceGallery.java](../../android/app/src/main/java/com/lifeatlas/app/r2/R2DeviceGallery.java)
- [R2Duplicates.java](../../android/app/src/main/java/com/lifeatlas/app/r2/R2Duplicates.java)
- [R2Envelope.java](../../android/app/src/main/java/com/lifeatlas/app/r2/R2Envelope.java)
- [R2Exception.java](../../android/app/src/main/java/com/lifeatlas/app/r2/R2Exception.java)
- [R2GalleryAccess.java](../../android/app/src/main/java/com/lifeatlas/app/r2/R2GalleryAccess.java)
- [R2GalleryLocations.java](../../android/app/src/main/java/com/lifeatlas/app/r2/R2GalleryLocations.java)
- [R2GalleryPreview.java](../../android/app/src/main/java/com/lifeatlas/app/r2/R2GalleryPreview.java)
- [R2GalleryQueue.java](../../android/app/src/main/java/com/lifeatlas/app/r2/R2GalleryQueue.java)
- [R2ImportedMetadata.java](../../android/app/src/main/java/com/lifeatlas/app/r2/R2ImportedMetadata.java)
- [R2Io.java](../../android/app/src/main/java/com/lifeatlas/app/r2/R2Io.java)
- [R2Library.java](../../android/app/src/main/java/com/lifeatlas/app/r2/R2Library.java)
- [R2LibraryPreviews.java](../../android/app/src/main/java/com/lifeatlas/app/r2/R2LibraryPreviews.java)
- [R2LibraryStore.java](../../android/app/src/main/java/com/lifeatlas/app/r2/R2LibraryStore.java)
- [R2LibraryWorker.java](../../android/app/src/main/java/com/lifeatlas/app/r2/R2LibraryWorker.java)
- [R2PlaceBackup.java](../../android/app/src/main/java/com/lifeatlas/app/r2/R2PlaceBackup.java)
- [R2Policy.java](../../android/app/src/main/java/com/lifeatlas/app/r2/R2Policy.java)
- [R2PublicMetadata.java](../../android/app/src/main/java/com/lifeatlas/app/r2/R2PublicMetadata.java)
- [R2Publication.java](../../android/app/src/main/java/com/lifeatlas/app/r2/R2Publication.java)
- [R2PublicationSession.java](../../android/app/src/main/java/com/lifeatlas/app/r2/R2PublicationSession.java)
- [R2QueueState.java](../../android/app/src/main/java/com/lifeatlas/app/r2/R2QueueState.java)
- [R2Repository.java](../../android/app/src/main/java/com/lifeatlas/app/r2/R2Repository.java)
- [R2SecureStore.java](../../android/app/src/main/java/com/lifeatlas/app/r2/R2SecureStore.java)
- [R2StoragePlugin.java](../../android/app/src/main/java/com/lifeatlas/app/r2/R2StoragePlugin.java)
- [R2Takeout.java](../../android/app/src/main/java/com/lifeatlas/app/r2/R2Takeout.java)
- [R2TakeoutWorker.java](../../android/app/src/main/java/com/lifeatlas/app/r2/R2TakeoutWorker.java)
- [R2Thumbnails.java](../../android/app/src/main/java/com/lifeatlas/app/r2/R2Thumbnails.java)
- [R2TransferWorker.java](../../android/app/src/main/java/com/lifeatlas/app/r2/R2TransferWorker.java)
- [R2Transport.java](../../android/app/src/main/java/com/lifeatlas/app/r2/R2Transport.java)
- [R2TripQueue.java](../../android/app/src/main/java/com/lifeatlas/app/r2/R2TripQueue.java)
- [R2VideoPreviewWorker.java](../../android/app/src/main/java/com/lifeatlas/app/r2/R2VideoPreviewWorker.java)

### `security`

- [AtlasDeviceStore.java](../../android/app/src/main/java/com/lifeatlas/app/security/AtlasDeviceStore.java)
- [AtlasSecurity.java](../../android/app/src/main/java/com/lifeatlas/app/security/AtlasSecurity.java)
- [AtlasSecurityPlugin.java](../../android/app/src/main/java/com/lifeatlas/app/security/AtlasSecurityPlugin.java)

## Specialist documentation index

These documents often include historical test counts, old instructions and local-only artifact links. Use their implementation details with the current handover status; check code when they disagree.

- [Custom Atlas home-screen icons](../ATLAS_APP_ICONS.md) — `docs/ATLAS_APP_ICONS.md`
- [Direct module launch](../ATLAS_DIRECT_LAUNCH.md) — `docs/ATLAS_DIRECT_LAUNCH.md`
- [Atlas Video in a browser](../ATLAS_VIDEO_WEB.md) — `docs/ATLAS_VIDEO_WEB.md`
- [Closing door: aperture-driven lighting](../CLOSING-DOOR-LIGHT.md) — `docs/CLOSING-DOOR-LIGHT.md`
- [Creator Studio — public website editing](../CREATOR-STUDIO.md) — `docs/CREATOR-STUDIO.md`
- [Landing film ribbon](../CURVED-FILM-STRIP.md) — `docs/CURVED-FILM-STRIP.md`
- [Atlas photo library — 2.0.0](../GALLERY-LIBRARY.md) — `docs/GALLERY-LIBRARY.md`
- [Gallery and shared-shell performance pass — 2026-11-27](../GALLERY_PERFORMANCE_POLISH.md) — `docs/GALLERY_PERFORMANCE_POLISH.md`
- [HERO-FILMS](../HERO-FILMS.md) — `docs/HERO-FILMS.md`
- [Observatory controls](../OBSERVATORY-CONTROLS.md) — `docs/OBSERVATORY-CONTROLS.md`
- [Optional public trip content](../OPTIONAL-TRIP-DETAILS.md) — `docs/OPTIONAL-TRIP-DETAILS.md`
- [The people along the way](../PEOPLE-MOMENTS.md) — `docs/PEOPLE-MOMENTS.md`
- [Public loading and motion preparation](../PUBLIC-LOADING.md) — `docs/PUBLIC-LOADING.md`
- [Shared public paper palette](../PUBLIC-PAPER-PALETTE.md) — `docs/PUBLIC-PAPER-PALETTE.md`
- [Native R2 storage](../R2-NATIVE-STORAGE.md) — `docs/R2-NATIVE-STORAGE.md`
- [Trip Archive: vertical perspective reel](../TRIP-ARCHIVE-REEL.md) — `docs/TRIP-ARCHIVE-REEL.md`
- [The travel journal — trip detail redesign](../TRIP-DETAIL-REDESIGN.md) — `docs/TRIP-DETAIL-REDESIGN.md`
- [Trip → website publishing and GPS corrections](../TRIP-WEBSITE-PUBLISHING.md) — `docs/TRIP-WEBSITE-PUBLISHING.md`
- [Atlas account recovery — implementation status](../atlas-account-recovery.md) — `docs/atlas-account-recovery.md`
- [Atlas Apps and Atlas Video on the web](../atlas-apps/README.md) — `docs/atlas-apps/README.md`
- [Android previews from GitHub Actions](../builds/android-preview.md) — `docs/builds/android-preview.md`
- [Atlas AI phase 2 — 2026-11-06](../checkpoints/atlas-ai-phase-2-2026-11-06.md) — `docs/checkpoints/atlas-ai-phase-2-2026-11-06.md`
- [Phase 3 checkpoint — partial, inference not verified](../checkpoints/atlas-ai-phase-3-2026-11-06.md) — `docs/checkpoints/atlas-ai-phase-3-2026-11-06.md`
- [Phase 4 implementation checkpoint](../checkpoints/atlas-ai-phase-4-2026-11-06.md) — `docs/checkpoints/atlas-ai-phase-4-2026-11-06.md`
- [Phase 5 — native readiness checkpoint (2026-11-06)](../checkpoints/atlas-ai-phase-5-2026-11-06.md) — `docs/checkpoints/atlas-ai-phase-5-2026-11-06.md`
- [Atlas 2.1.0 — unified Android test release](../checkpoints/atlas-unified-2.1.0.md) — `docs/checkpoints/atlas-unified-2.1.0.md`
- [Atlas — Hey Atlas Wake-Word & Voice Assistant Handoff Context](../checkpoints/hey-atlas-phase2-handoff.md) — `docs/checkpoints/hey-atlas-phase2-handoff.md`
- [Atlas — Hey Atlas Phase 3 Handoff Context](../checkpoints/hey-atlas-phase3-handoff.md) — `docs/checkpoints/hey-atlas-phase3-handoff.md`
- [Security foundation checkpoint — 2026-11-06](../checkpoints/security-foundation-2026-11-06.md) — `docs/checkpoints/security-foundation-2026-11-06.md`
- [Website and Atlas AI integration checkpoint](../checkpoints/website-atlas-ai-integration-2026-11-18.md) — `docs/checkpoints/website-atlas-ai-integration-2026-11-18.md`
- [Atlas — Hey Atlas Wake-Word Feasibility Experiment](../experiments/hey-atlas-wakeword.md) — `docs/experiments/hey-atlas-wakeword.md`
- [Monthly review](../finance-monthly/README.md) — `docs/finance-monthly/README.md`
- [Atlas Finance reliability and daily-use improvements](../finance-reliability/README.md) — `docs/finance-reliability/README.md`
- [Repayment matching and Atlas Finance performance](../finance-repayments/README.md) — `docs/finance-repayments/README.md`
- [Shared expenses and settlements](../finance-shared/README.md) — `docs/finance-shared/README.md`
- [Atlas Finance: split a payment during review](../finance-split-review/README.md) — `docs/finance-split-review/README.md`
- [Gallery 2.2 — fast interaction and private personalization](../gallery/gallery-2.2.md) — `docs/gallery/gallery-2.2.md`
- [On-device gallery search](../gallery/on-device-search.md) — `docs/gallery/on-device-search.md`
- [Private gallery smart collections](../gallery/smart-collections.md) — `docs/gallery/smart-collections.md`
- [Phone verification: Moto Edge 50 Fusion, 8 GB physical RAM, Android 16](../local-intelligence/DEVICE-TESTS.md) — `docs/local-intelligence/DEVICE-TESTS.md`
- [Changed files](../local-intelligence/FILES.md) — `docs/local-intelligence/FILES.md`
- [Model artifact review — 24 November 2026](../local-intelligence/MODELS.md) — `docs/local-intelligence/MODELS.md`
- [Atlas local intelligence](../local-intelligence/README.md) — `docs/local-intelligence/README.md`
- [Validation report — 24 November 2026, completion pass](../local-intelligence/VALIDATION.md) — `docs/local-intelligence/VALIDATION.md`
- [Reproducible Windows validation (not executed here)](../local-intelligence/WINDOWS-TESTS.md) — `docs/local-intelligence/WINDOWS-TESTS.md`
- [App session loading and navigation](../qa/app-session-performance.md) — `docs/qa/app-session-performance.md`
- [Atlas 2.3.1: startup and local-screen performance](../qa/app-startup-2.3.1.md) — `docs/qa/app-startup-2.3.1.md`
- [Atlas Music performance and product naming](../qa/atlas-music-performance.md) — `docs/qa/atlas-music-performance.md`
- [Atlas Photos — Gallery redesign, 1.7.0 (26)](../qa/atlas-photos-design.md) — `docs/qa/atlas-photos-design.md`
- [Cloud storage: structure and reliability foundation](../qa/cloud-storage-foundation.md) — `docs/qa/cloud-storage-foundation.md`
- [Gallery 2.0.5 update](../qa/gallery-2.0.5.md) — `docs/qa/gallery-2.0.5.md`
- [Atlas Gallery 2.2.3](../qa/gallery-2.2.3.md) — `docs/qa/gallery-2.2.3.md`
- [Atlas Gallery 2.2.4](../qa/gallery-2.2.4.md) — `docs/qa/gallery-2.2.4.md`
- [Atlas Gallery 2.2.5](../qa/gallery-2.2.5.md) — `docs/qa/gallery-2.2.5.md`
- [Atlas Gallery 2.2.6](../qa/gallery-2.2.6.md) — `docs/qa/gallery-2.2.6.md`
- [Atlas 2.2.7 — Places, display quality and viewer](../qa/gallery-2.2.7.md) — `docs/qa/gallery-2.2.7.md`
- [Atlas 2.2.8 — final Gallery update](../qa/gallery-2.2.8.md) — `docs/qa/gallery-2.2.8.md`
- [Atlas 2.2.9 — Gallery AI foundations](../qa/gallery-ai-2.2.9.md) — `docs/qa/gallery-ai-2.2.9.md`
- [Atlas 2.3.0 — analysis health, priority and recovery verification](../qa/gallery-analysis-2.3.0.md) — `docs/qa/gallery-analysis-2.3.0.md`
- [Gallery performance and storage — code-only update](../qa/gallery-performance-storage.md) — `docs/qa/gallery-performance-storage.md`
- [Places organizer — Atlas 1.6.1 (25)](../qa/gallery-places.md) — `docs/qa/gallery-places.md`
- [Gallery responsiveness and local diagnostics](../qa/gallery-responsiveness.md) — `docs/qa/gallery-responsiveness.md`
- [Native upload duplicate detection](../qa/native-upload-deduplication.md) — `docs/qa/native-upload-deduplication.md`
- [Optional authentication — code-only implementation](../qa/optional-authentication.md) — `docs/qa/optional-authentication.md`
- [Private photo and video Gallery — Atlas 1.5.1](../qa/private-gallery.md) — `docs/qa/private-gallery.md`
- [Trip covers and Creator Studio](../qa/trip-covers-and-studio.md) — `docs/qa/trip-covers-and-studio.md`
- [Atlas voice activation modes (experimental Google bridge)](../qa/voice-activation-modes.md) — `docs/qa/voice-activation-modes.md`

## Separate Atlas Video source (not inside this repository)

Transfer `/workspace/atlas-video` separately. Its main notes are `README.md`, `ATLAS_VIDEO.md`, and `docs/FEATURES_AND_ATLAS_MUSIC.md`. The checkout currently has only an upstream NewPipe remote. Do not expect a clone of Saikrishna65/life-atlas to contain those files.

## Tests and scripts

Test categories currently present: `account`, `app-icons`, `atlas-ai`, `cloud-vault`, `companion-apps`, `control-room`, `finance`, `gallery`, `mobile`, `music`, `performance`, `public`, `public-trips`, `r2`, `security`, `studio`, `vault`, `video`, `wakeword`.

For test/build instructions and paused APK policy see [Project guide](PROJECT-GUIDE.md). Never run a script merely because it contains “test”: some server reset/cloud tools can mutate data.
