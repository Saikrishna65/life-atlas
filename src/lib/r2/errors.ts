const messages: Record<string, string> = {
  ANDROID_TRANSFER_STOPPED: "Android stopped this transfer. Its saved parts and original remain available; resume approved uploads to continue.",
  BACKGROUND_UPLOAD_RESTRICTED: "Android prevented the upload service from starting. Reopen Atlas Next, allow background battery usage for it, and resume approved uploads.",
  STORAGE_PERMISSION_DENIED: "Android denied access to the source file or upload service. Open Atlas Next and check its permissions; your original and saved selections remain unchanged.",
  GALLERY_PERMISSION_REQUIRED: "Allow photo and video access in Gallery, or choose more photos in Android permissions. Your originals are unchanged.",
  SOURCE_UNAVAILABLE: "Android could not open this original. Make sure its storage provider and original file are still available. Do not delete your saved trip.",
  SELECTION_LIMIT_EXCEEDED: "Select up to 20 photos or videos at a time. Add another batch for the same place.",
  ANDROID_VERSION_UNSUPPORTED:
    "Cloud storage needs Android 8 or later. Your local vaults remain available.",
  BUNDLED_APP_REQUIRED:
    "Open the installed, offline Life Atlas Android app to configure storage.",
  AUTHENTICATION_CANCELLED:
    "Device verification was cancelled. Nothing was changed.",
  PUBLICATION_SESSION_REQUIRED: "The app’s publishing session was replaced or restarted. Approved native uploads stay queued. Reopen this trip to finish the website update without re-uploading completed files.",
  PUBLICATION_SESSION_EXPIRED: "The app’s publishing session was replaced or restarted. Approved native uploads stay queued. Reopen this trip to finish the website update without re-uploading completed files.",
  PUBLICATION_SCOPE_MISMATCH: "This file is outside the approved trip batch. Reopen the trip and approve publishing again; your saved files are unchanged.",
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
  R2_SIGNING_FAILED:
    "Android could not sign the R2 S3 request. Update Life Atlas and test again. (R2_SIGNING_FAILED)",
  R2_REQUEST_REJECTED:
    "R2 rejected the S3 request. Check the account endpoint and bucket configuration. (R2_REQUEST_REJECTED)",
  R2_REQUEST_FAILED:
    "Android could not complete the R2 request. Check connectivity and test again. (R2_REQUEST_FAILED)",
  TLS_CONNECTION_FAILED:
    "The secure connection to R2 failed. Check the device date/time and network, then retry. (TLS_CONNECTION_FAILED)",
  CLOCK_SKEW:
    "R2 rejected the request time. Enable automatic date and time in Android Settings, then test again. (CLOCK_SKEW)",
  INVALID_XML_RESPONSE:
    "The storage endpoint returned an invalid S3 response. Check the endpoint and network. (INVALID_XML_RESPONSE)",
  STORAGE_OPERATION_FAILED:
    "The native storage operation failed. Your local originals are unchanged. (STORAGE_OPERATION_FAILED)",
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
    "The catalog changed while publishing. Your selected photos and completed uploads are saved. Tap Publish again to resume; do not reselect or delete them.",
  MISSING_CATALOG_ETAG: "R2 did not return the catalog version needed for a safe update. The existing catalog was preserved. Reconnect and retry publishing.",
  INVALID_PUBLIC_CATALOG: "The public catalog could not be verified. Its existing contents were preserved; do not delete or reset it.",
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
  const object = typeof error === "object" && error !== null ? error : null;
  // Only fixed, known codes may cross into UI. Never render SDK exception text,
  // signed URLs, request bodies or credentials, even when the bridge omits code.
  const code = object && "code" in object && typeof object.code === "string"
    ? object.code : object && "message" in object && typeof object.message === "string"
      ? object.message : typeof error === "string" ? error : "";
  return (
    (Object.prototype.hasOwnProperty.call(messages, code) ? messages[code] : undefined) ??
    "The storage operation could not finish. Your local originals are unchanged. Refresh and retry."
  );
}
