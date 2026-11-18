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
