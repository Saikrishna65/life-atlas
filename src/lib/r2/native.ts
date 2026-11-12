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
  }): Promise<Transfer>;
  downloadObject(input: {
    slot: BucketSlot;
    key: string;
    name: string;
  }): Promise<Transfer | { cancelled: true }>;
  getTransferProgress(): Promise<{ transfers: Transfer[] }>;
  cancelTransfer(input: { id: string }): Promise<void>;
  pauseTransfer(input: { id: string }): Promise<void>;
  resumeTransfer(input: { id: string }): Promise<void>;
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
const messages: Record<string, string> = {
  ANDROID_VERSION_UNSUPPORTED:
    "Cloud storage needs Android 8 or later. Your local vaults remain available.",
  BUNDLED_APP_REQUIRED:
    "Open the installed, offline Life Atlas Android app to configure storage.",
  AUTHENTICATION_CANCELLED:
    "Device verification was cancelled. Nothing was changed.",
  AUTHENTICATION_BUSY: "Finish the current device verification first.",
  DEVICE_LOCK_REQUIRED:
    "Set up a secure Android screen lock or strong biometric before configuring storage.",
  INVALID_ACCOUNT: "Enter your 32-character Cloudflare Account ID.",
  INVALID_ENDPOINT:
    "Use the account’s HTTPS R2 S3 endpoint, including supported EU or FedRAMP jurisdiction endpoints.",
  INVALID_BUCKET: "Enter a valid R2 bucket name.",
  INVALID_PUBLIC_URL:
    "Use an HTTPS public R2 development URL or custom media domain, without credentials or query parameters.",
  INVALID_CREDENTIALS:
    "Both access and secret keys are required. Check for spaces or missing characters.",
  BUCKETS_MUST_BE_SEPARATE:
    "Use different buckets and separately scoped tokens for public and private storage.",
  KEYSTORE_RESET_NOT_NEEDED:
    "The encrypted storage is readable and was preserved. Use the normal credential replacement controls.",
  PUBLIC_PREVIEW_FORMAT_UNSUPPORTED:
    "This original can be stored and downloaded, but its format is not supported in the public gallery. Create an explicitly approved JPEG, PNG, WebP or browser-compatible video copy for publishing.",
  CLOUD_CLEANUP_REQUIRED:
    "The transfer stopped, but remote cleanup could not finish. Reconnect and cancel again before replacing credentials.",
  PUBLIC_BASE_URL_REQUIRED: "Set the public media base URL before publishing.",
  VERIFIED_PUBLIC_COPY_REQUIRED:
    "Wait for the separate public upload to finish byte verification before publishing.",
  PUBLIC_COPY_DELETE_FAILED:
    "The catalog entry was removed, but the public object could not be deleted. It may still be reachable by URL; refresh the library and delete that public copy.",
  PUBLIC_DISCLOSURE_REQUIRED:
    "Approve the public metadata disclosure before publishing.",
  CATALOG_LIMIT_REACHED:
    "This catalog has reached its current 5,000-item safety limit. Split it into separate catalogs before adding more.",
  NOT_CONFIGURED: "Configure this bucket first.",
  AUTHENTICATION_FAILED:
    "R2 rejected the credentials. Replace the token or check the account endpoint.",
  PERMISSION_DENIED:
    "The token does not allow this operation. Check its bucket-specific object read/write permissions.",
  BUCKET_NOT_FOUND: "The bucket was not found at this endpoint.",
  OBJECT_NOT_FOUND: "This object no longer exists. Refresh the library.",
  NETWORK_UNAVAILABLE:
    "R2 is unreachable. Local media remains safe; queued transfers wait for connectivity.",
  REMOTE_TEMPORARY_FAILURE:
    "R2 is temporarily unavailable. Transfers use bounded exponential retries.",
  KEYSTORE_UNAVAILABLE:
    "Android cannot open the storage keys. Reconfigure credentials and restore your independently saved recovery kit; never delete the remote encrypted files.",
  RECOVERY_REQUIRED:
    "Create a recovery kit, save it outside this device, then reopen and verify it before uploading private files.",
  RECOVERY_PASSPHRASE_TOO_SHORT:
    "Use a unique recovery passphrase of at least 16 characters.",
  RECOVERY_VERIFICATION_FAILED:
    "The recovery kit or passphrase could not be verified. No existing key was replaced.",
  DIFFERENT_RECOVERY_KEY:
    "This kit belongs to a different encryption key. The current key was preserved.",
  UNFINISHED_TRANSFERS:
    "Finish or explicitly cancel transfers for this bucket before changing its configuration.",
  PERSISTENT_URI_REQUIRED:
    "This provider did not grant lasting file access. Select the original using the document picker.",
  INSUFFICIENT_DEVICE_SPACE:
    "There is not enough temporary device storage to safely stage this original.",
  SOURCE_CHANGED:
    "The selected file changed while preparing it. Select the original again.",
  INTEGRITY_FAILED:
    "The byte checksum did not match. This transfer is not marked complete.",
  DECRYPTION_FAILED:
    "The file could not authenticate with this encryption key. Keep the original and check the recovery kit.",
  CATALOG_CONFLICT:
    "The public catalog changed elsewhere. Refresh and publish again; the existing catalog was preserved.",
  CATALOG_DELETE_BLOCKED:
    "Catalog objects are managed through Publish to Website.",
  PUBLISHED_OBJECT: "Unpublish this item before deleting its public object.",
  PREVIEW_UNAVAILABLE:
    "A small preview is not supported for this format. Download the authenticated original to view it.",
  PREVIEW_TOO_LARGE:
    "This original is too large for an inline photo preview. Download the original instead.",
  METADATA_REMOVAL_UNSUPPORTED:
    "Lossless metadata removal supports JPEG, PNG and WebP. For other formats, prepare a sanitized public copy first or explicitly retain its metadata.",
};
export function storageError(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "";
  return (
    messages[code] ??
    "The storage operation could not finish. Your local originals are unchanged. Refresh and retry."
  );
}
export function bytes(value = 0) {
  if (value === 0) return "0 B";
  const i = Math.min(
    4,
    Math.floor(Math.log(Math.max(1, value)) / Math.log(1024)),
  );
  return `${(value / 1024 ** i).toFixed(i ? 1 : 0)} ${["B", "KB", "MB", "GB", "TB"][i]}`;
}
