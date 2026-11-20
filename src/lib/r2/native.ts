"use client";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { setSystemPickerActive } from "@/lib/deviceAuth";
import type {
  BucketSlot,
  ConfigurationInput,
  ObjectMetadata,
  ObjectPage,
  PublicMediaCatalog,
  PublishInput,
  SelectedMedia,
  StorageSummary,
  Transfer,
} from "./types";
interface R2Plugin {
  getGalleryIntelligence():Promise<import('../gallery/intelligence').GalleryIntelligenceStatus>;
  configureGalleryIntelligence(input:import('../gallery/intelligence').GalleryIntelligenceSettings & {approved:true}):Promise<import('../gallery/intelligence').GalleryIntelligenceStatus>;
  controlGalleryIntelligence(input:{action:'pause'|'resume'|'scan'|'clear'}):Promise<import('../gallery/intelligence').GalleryIntelligenceStatus>;
  searchGalleryIntelligence(input:{query:string;album:string;kind:string;offset:number}):Promise<import('../gallery/types').DevicePage>;
  getDeviceTrash(input:{cursor:string}):Promise<{items:{id:string;name:string;mimeType:string;size:number;expiresAt:number}[];cursor:string;complete:boolean}>;
  saveLibraryPreferences(input:{trashDays:number}):Promise<void>;
  beginLibrarySession():Promise<{session:string}>;
  endLibrarySession():Promise<void>;
  getLibraryStatus():Promise<import('../gallery/library').LibraryStatus>;
  getBackupAlbums():Promise<{albums:{id:string;name:string;count:number}[]}>;
  configureAutoBackup(input:{settings:import('../gallery/library').BackupSettings}):Promise<import('../gallery/library').BackupSettings>;
  scanBackupNow():Promise<void>;
  listLibrary(input:{session:string;slot:'public'|'private';state:string;offset:number}):Promise<import('../gallery/library').LibraryPage>;
  libraryThumbnail(input:{session:string;id:string}):Promise<{path?:string;url?:string}>;
  libraryPreview(input:{session:string;id:string;variant:'original'|'clip'}):Promise<{path?:string;url?:string;token?:string;mimeType?:string}>;
  downloadLibraryOriginal(input:{session:string;id:string}):Promise<unknown>;
  changeLibraryTrash(input:{action:'trash'|'restore'|'purge';ids:string[];days?:number}):Promise<{session:string}>;
  startLibraryTask(input:{action:'restore'|'sync'|'reconcile'}):Promise<void>;
  trashDeviceMedia(input:{ids:string[];trashed:boolean}):Promise<{approved:boolean}>;
  pickTakeoutArchives():Promise<{files:{id:string;name:string}[]}>;
  controlTakeoutImport(input:{id:string;action:'start'|'pause'}):Promise<void>;
  readDeviceLocations(input:{ids:string[];versions:Record<string,string>}):Promise<{items:import('../gallery/places').LocationRead[]}>;
  fingerprintGalleryMedia(input:{ids:string[];versions:Record<string,string>}):Promise<{items:import('../gallery/places').LocationRead[]}>;
  backupPlaceCatalog(input:{catalog:import('../gallery/places').PlaceLibrary}):Promise<{key:string;size:number}>;
  listPlaceBackups(input:{cursor:string}):Promise<ObjectPage>;
  restorePlaceCatalog(input:{key:string}):Promise<{catalog:unknown}>;
  getGalleryAccess():Promise<import('../gallery/types').GalleryAccess>;
  requestGalleryAccess():Promise<import('../gallery/types').GalleryAccess>;
  openGallerySettings():Promise<void>;
  listDeviceMedia(input:{cursor:string;query:string;kind:string;album:string;order:string}):Promise<import('../gallery/types').DevicePage>;
  getGalleryAlbums():Promise<{albums:{name:string;count:number}[]}>;
  getDeviceThumbnail(input:{id:string}):Promise<{path:string}>;
  registerDeviceMedia(input:{ids:string[];versions?:Record<string,string>}):Promise<{files:SelectedMedia[]}>;
  checkDeviceCloud(input:{ids:string[]}):Promise<{items:{id:string;copies:import('../gallery/types').DeviceMedia['copies']}[]}>;
  openGalleryCloudPreview(input:{key:string}):Promise<{token:string;path:string;mimeType:string;name:string}>;
  releaseGalleryPreview(input:{token:string}):Promise<void>;
  queueGalleryUploads(input:{slot:BucketSlot;selectionIds:string[]}):Promise<{transferIds:Record<string,string>}>;
  setSensitiveScreen(input: { enabled: boolean }): Promise<void>;
  getConfigurationSummary(): Promise<StorageSummary>;
  saveConfiguration(input: ConfigurationInput): Promise<unknown>;
  disconnectBucket(input: { slot: BucketSlot }): Promise<void>;
  testConnection(input: {
    slot: BucketSlot;
  }): Promise<{ status: string; verified: boolean }>;
  listObjects(input: {
    slot: BucketSlot;
    prefix: string;
    cursor: string;
    revision?:string;
  }): Promise<ObjectPage>;
  getObjectMetadata(input: {
    slot: BucketSlot;
    key: string;
  }): Promise<ObjectMetadata>;
  deleteObject(input: { slot: BucketSlot; key: string }): Promise<void>;
  deleteObjects(input: {
    slot: BucketSlot;
    keys: string[];
  }): Promise<{ deleted: string[] }>;
  pickMedia(input: {
    picker: "photos" | "documents";
  }): Promise<{ files: SelectedMedia[] }>;
  getSelectionPreview(input: { id: string }): Promise<{ thumbnail: string }>;
  getObjectPreview(input: {
    slot: BucketSlot;
    key: string;
  }): Promise<{ thumbnail: string }>;
  uploadObject(input: {
    slot: BucketSlot;
    selectionId: string;
    stripMetadata?: boolean;
    publicationSession?: string;
  }): Promise<Transfer>;
  downloadObject(input: {
    slot: BucketSlot;
    key: string;
    name: string;
  }): Promise<Transfer | { cancelled: true }>;
  recoverTripUploads():Promise<{recovered:number}>;
  getTransferProgress(): Promise<{ transfers: Transfer[] }>;
  cancelTransfer(input: { id: string }): Promise<void>;
  pauseTransfer(input: { id: string }): Promise<void>;
  resumeTransfer(input: { id: string; publicationSession?: string }): Promise<void>;
  startMultipartUpload(input: { id: string }): Promise<unknown>;
  uploadMultipartPart(input: { id: string; number: number }): Promise<unknown>;
  completeMultipartUpload(input: { id: string }): Promise<unknown>;
  abortMultipartUpload(input: { id: string }): Promise<void>;
  createRecoveryKit(input: {
    passphrase: string;
  }): Promise<{ saved: boolean; verified: boolean }>;
  restoreRecoveryKit(input: {
    passphrase: string;
  }): Promise<{ verified: boolean }>;
  resetUnavailableKeystore(): Promise<void>;
  publishMedia(input: PublishInput): Promise<{
    catalogUrl: string;
    websiteUrl: string;
    catalog: PublicMediaCatalog;
  }>;
  beginTripPublication(input:{collection:string;selectionIds:string[];transferIds:string[];transfersBySelection:Record<string,string>}):Promise<{publicationSession:string;transferIds:Record<string,string>}>;
  endTripPublication(input:{publicationSession:string}):Promise<void>;
  publishTripMedia(input:PublishInput & {publicationSession?:string}):Promise<{item:import("./types").PublishedMedia;manifestUrl:string}>;
  unpublishMedia(input: {
    id: string;
  }): Promise<{ catalog: PublicMediaCatalog }>;
  getPublicCatalog(): Promise<{
    catalog: PublicMediaCatalog;
    catalogUrl: string;
    websiteUrl: string;
  }>;
  createPublicCopy(input: { key: string }): Promise<SelectedMedia>;
}
export const R2 = registerPlugin<R2Plugin>("AtlasR2Storage");
export function nativeR2Available() {
  return (
    Capacitor.getPlatform() === "android" &&
    Capacitor.isPluginAvailable("AtlasR2Storage")
  );
}
/** Prevent app-level resume handling from treating a system picker/auth sheet as a new session. */
export async function systemAction<T>(action: () => Promise<T>): Promise<T> {
  setSystemPickerActive(true);
  try {
    return await action();
  } finally {
    setSystemPickerActive(false);
  }
}
export {storageError} from "./errors";
export function bytes(value = 0) {
  if (value === 0) return "0 B";
  const i = Math.min(
    4,
    Math.floor(Math.log(Math.max(1, value)) / Math.log(1024)),
  );
  return `${(value / 1024 ** i).toFixed(i ? 1 : 0)} ${["B", "KB", "MB", "GB", "TB"][i]}`;
}
