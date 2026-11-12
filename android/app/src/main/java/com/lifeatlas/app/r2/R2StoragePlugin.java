package com.lifeatlas.app.r2;

import android.app.*;
import android.content.*;
import android.database.Cursor;
import android.graphics.*;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import android.provider.OpenableColumns;
import android.view.WindowManager;
import androidx.activity.result.ActivityResult;
import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.work.WorkManager;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;
import java.io.*;
import java.security.MessageDigest;
import java.util.*;
import org.json.*;

@CapacitorPlugin(name = "AtlasR2Storage")
public class R2StoragePlugin extends Plugin {
  interface Task {
    void run() throws Exception;
  }

  private boolean authenticating = false;
  private Task pendingAuth;
  private char[] recoveryPassword;
  private String recoveryMode;
  private byte[] pendingKit;
  private final Map<String, Uri> selections = new HashMap<>();

  private R2Repository repository() {
    return new R2Repository(getContext());
  }

  private void guard() throws Exception {
    if (Build.VERSION.SDK_INT < 26) throw new R2Exception("ANDROID_VERSION_UNSUPPORTED");
    java.util.concurrent.FutureTask<String> currentPage =
        new java.util.concurrent.FutureTask<>(() -> getBridge().getWebView().getUrl());
    getActivity().runOnUiThread(currentPage);
    String page = currentPage.get(5, java.util.concurrent.TimeUnit.SECONDS);
    Uri uri = page == null ? null : Uri.parse(page);
    if (uri == null || !"https".equals(uri.getScheme()) || !"localhost".equals(uri.getHost()))
      throw new R2Exception("BUNDLED_APP_REQUIRED");
  }

  private void fail(PluginCall call, Exception error) {
    String code = R2Policy.safeError(error);
    call.reject(code, code);
  }

  private JSObject js(JSONObject value) throws Exception {
    return JSObject.fromJSONObject(value);
  }

  private void work(PluginCall call, Task task) {
    execute(
        () -> {
          try {
            guard();
            task.run();
          } catch (Exception error) {
            fail(call, error);
          }
        });
  }

  private void authenticated(PluginCall call, Task task) {
    try {
      guard();
    } catch (Exception error) {
      fail(call, error);
      return;
    }
    getActivity()
        .runOnUiThread(
            () -> {
              if (authenticating) {
                call.reject("AUTHENTICATION_BUSY", "AUTHENTICATION_BUSY");
                return;
              }
              authenticating = true;
              if (Build.VERSION.SDK_INT < 30) {
                KeyguardManager manager =
                    (KeyguardManager) getContext().getSystemService(Context.KEYGUARD_SERVICE);
                Intent intent =
                    manager.createConfirmDeviceCredentialIntent(
                        "Life Atlas cloud storage", "Verify your device lock to continue");
                if (intent == null) {
                  authenticating = false;
                  call.reject("DEVICE_LOCK_REQUIRED", "DEVICE_LOCK_REQUIRED");
                  return;
                }
                pendingAuth = task;
                startActivityForResult(call, intent, "deviceAuthenticated");
                return;
              }
              int allowed =
                  BiometricManager.Authenticators.BIOMETRIC_STRONG
                      | BiometricManager.Authenticators.DEVICE_CREDENTIAL;
              if (BiometricManager.from(getContext()).canAuthenticate(allowed)
                  != BiometricManager.BIOMETRIC_SUCCESS) {
                authenticating = false;
                call.reject("DEVICE_LOCK_REQUIRED", "DEVICE_LOCK_REQUIRED");
                return;
              }
              BiometricPrompt prompt =
                  new BiometricPrompt(
                      getActivity(),
                      ContextCompat.getMainExecutor(getContext()),
                      new BiometricPrompt.AuthenticationCallback() {
                        @Override
                        public void onAuthenticationSucceeded(
                            @NonNull BiometricPrompt.AuthenticationResult result) {
                          authenticating = false;
                          work(call, task);
                        }

                        @Override
                        public void onAuthenticationError(int code, @NonNull CharSequence text) {
                          authenticating = false;
                          call.reject("AUTHENTICATION_CANCELLED", "AUTHENTICATION_CANCELLED");
                        }
                      });
              prompt.authenticate(
                  new BiometricPrompt.PromptInfo.Builder()
                      .setTitle("Life Atlas cloud storage")
                      .setSubtitle("Confirm this storage operation")
                      .setAllowedAuthenticators(allowed)
                      .build());
            });
  }

  @ActivityCallback
  private void deviceAuthenticated(PluginCall call, ActivityResult result) {
    Task task = pendingAuth;
    pendingAuth = null;
    authenticating = false;
    if (call == null) return;
    if (result.getResultCode() == Activity.RESULT_OK && task != null) work(call, task);
    else call.reject("AUTHENTICATION_CANCELLED", "AUTHENTICATION_CANCELLED");
  }

  @PluginMethod
  public void setSensitiveScreen(PluginCall call) {
    try {
      guard();
      getActivity()
          .runOnUiThread(
              () -> {
                if (call.getBoolean("enabled", false))
                  getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
                else getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
                call.resolve();
              });
    } catch (Exception e) {
      fail(call, e);
    }
  }

  @PluginMethod
  public void getConfigurationSummary(PluginCall call) {
    work(
        call,
        () -> {
          R2Repository repository = repository();
          JSONObject state = repository.store.snapshot();
          JSONObject out =
              new JSONObject()
                  .put("supported", true)
                  .put("hardwareBacked", repository.store.hardwareBacked())
                  .put("recoveryVerified", state.optBoolean("recoveryVerified"))
                  .put("keyId", state.has("keyset") ? R2Crypto.keyId(repository.keyset()) : "");
          for (String slot : new String[] {"public", "private"})
            out.put(
                slot,
                state.has(slot)
                    ? repository.store.credentials(slot).summary(slot)
                    : new JSONObject().put("slot", slot).put("configured", false));
          call.resolve(js(out));
        });
  }

  @PluginMethod
  public void saveConfiguration(PluginCall call) {
    JSONObject input = new JSONObject();
    try {
      for (String field :
          new String[] {
            "slot",
            "accountId",
            "endpoint",
            "bucket",
            "accessKeyId",
            "secretAccessKey",
            "publicBaseUrl"
          }) input.put(field, call.getString(field, ""));
      input.put("revision", UUID.randomUUID().toString());
    } catch (Exception e) {
      fail(call, e);
      return;
    }
    call.getData().remove("accessKeyId");
    call.getData().remove("secretAccessKey");
    authenticated(
        call,
        () -> {
          try {
            String slot = R2Policy.slot(input.getString("slot"));
            R2Credentials next = new R2Credentials(input);
            R2Repository repository = repository();
            if (repository.unfinished(slot)) throw new R2Exception("UNFINISHED_TRANSFERS");
            String other = slot.equals("public") ? "private" : "public";
            JSONObject existing = repository.store.snapshot().optJSONObject(other);
            if (existing != null
                && (existing.getString("accessKeyId").equals(next.access)
                    || (existing.getString("bucket").equals(next.bucket)
                        && existing.getString("accountId").equals(next.account))))
              throw new R2Exception("BUCKETS_MUST_BE_SEPARATE");
            repository.store.edit(state -> state.put(slot, input));
            call.resolve(js(next.summary(slot)));
          } finally {
            input.remove("accessKeyId");
            input.remove("secretAccessKey");
          }
        });
  }

  @PluginMethod
  public void disconnectBucket(PluginCall call) {
    authenticated(
        call,
        () -> {
          String slot = R2Policy.slot(call.getString("slot"));
          R2Repository repository = repository();
          if (repository.unfinished(slot)) throw new R2Exception("UNFINISHED_TRANSFERS");
          repository.store.edit(state -> state.remove(slot));
          call.resolve();
        });
  }

  @PluginMethod
  public void testConnection(PluginCall call) {
    authenticated(
        call,
        () -> {
          String slot = R2Policy.slot(call.getString("slot"));
          R2Client client = new R2Client(repository().store.credentials(slot));
          String key = ".life-atlas-tests/" + UUID.randomUUID();
          byte[] content = new byte[256];
          new java.security.SecureRandom().nextBytes(content);
          boolean created = false;
          try {
            try (R2Client.Response ignored =
                client.request(
                    "HEAD", "", Collections.emptyMap(), Collections.emptyMap(), null, null)) {}
            try (R2Client.Response ignored =
                client.request(
                    "PUT",
                    key,
                    Collections.emptyMap(),
                    Map.of("Content-Type", "application/octet-stream", "If-None-Match", "*"),
                    R2Client.bytes(content),
                    null)) {
              created = true;
            }
            byte[] downloaded;
            try (R2Client.Response response =
                client.request(
                    "GET", key, Collections.emptyMap(), Collections.emptyMap(), null, null)) {
              downloaded = response.read(1024);
            }
            if (!MessageDigest.isEqual(
                MessageDigest.getInstance("SHA-256").digest(content),
                MessageDigest.getInstance("SHA-256").digest(downloaded)))
              throw new R2Exception("INTEGRITY_FAILED");
            client.delete(key);
            created = false;
            call.resolve(new JSObject().put("status", "connected").put("verified", true));
          } finally {
            if (created) {
              try {
                client.delete(key);
              } catch (Exception ignored) {
                /* Unique synthetic object may require manual cleanup; never delete other keys. */
              }
            }
          }
        });
  }

  @PluginMethod
  public void listObjects(PluginCall call) {
    work(
        call,
        () -> {
          String slot = R2Policy.slot(call.getString("slot"));
          JSONObject out =
              new R2Client(repository().store.credentials(slot))
                  .list(call.getString("prefix", ""), call.getString("cursor", ""));
          call.resolve(js(out));
        });
  }

  @PluginMethod
  public void getObjectMetadata(PluginCall call) {
    work(
        call,
        () -> {
          String slot = R2Policy.slot(call.getString("slot"));
          call.resolve(
              js(
                  new R2Client(repository().store.credentials(slot))
                      .head(R2Policy.key(call.getString("key")))));
        });
  }

  @PluginMethod
  public void deleteObject(PluginCall call) {
    authenticated(
        call,
        () -> {
          String slot = R2Policy.slot(call.getString("slot")),
              key = R2Policy.key(call.getString("key"));
          if (slot.equals("public") && key.startsWith("atlas/catalog/"))
            throw new R2Exception("CATALOG_DELETE_BLOCKED");
          if (slot.equals("public")
              && new R2Catalog(repository().store.credentials(slot)).references(key))
            throw new R2Exception("PUBLISHED_OBJECT");
          new R2Client(repository().store.credentials(slot)).delete(key);
          call.resolve();
        });
  }

  @PluginMethod
  public void pickMedia(PluginCall call) {
    try {
      guard();
      Intent intent;
      if ("photos".equals(call.getString("picker")) && Build.VERSION.SDK_INT >= 33) {
        intent = new Intent(MediaStore.ACTION_PICK_IMAGES);
        intent.setType("*/*");
        intent.putExtra(MediaStore.EXTRA_PICK_IMAGES_MAX, 20);
      } else {
        intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");
        intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
        intent.addFlags(
            Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
      }
      startActivityForResult(call, intent, "mediaSelected");
    } catch (Exception e) {
      fail(call, e);
    }
  }

  @ActivityCallback
  private void mediaSelected(PluginCall call, ActivityResult result) {
    if (call == null) return;
    work(
        call,
        () -> {
          JSONArray files = new JSONArray();
          Intent data = result.getData();
          if (result.getResultCode() != Activity.RESULT_OK || data == null) {
            call.resolve(new JSObject().put("files", files));
            return;
          }
          List<Uri> uris = new ArrayList<>();
          if (data.getClipData() != null) {
            for (int i = 0; i < Math.min(20, data.getClipData().getItemCount()); i++)
              uris.add(data.getClipData().getItemAt(i).getUri());
          } else if (data.getData() != null) uris.add(data.getData());
          for (Uri uri : uris) {
            if (!"content".equals(uri.getScheme())) continue;
            String id = UUID.randomUUID().toString();
            selections.put(id, uri);
            boolean persistent = true;
            try {
              getContext()
                  .getContentResolver()
                  .takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
            } catch (Exception e) {
              persistent = false;
            }
            String name = "Original media";
            long size = 0;
            try (Cursor cursor =
                getContext()
                    .getContentResolver()
                    .query(
                        uri,
                        new String[] {OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE},
                        null,
                        null,
                        null)) {
              if (cursor != null && cursor.moveToFirst()) {
                name = cursor.getString(0);
                if (!cursor.isNull(1)) size = cursor.getLong(1);
              }
            }
            String mime = getContext().getContentResolver().getType(uri);
            JSONObject item =
                new JSONObject()
                    .put("id", id)
                    .put("name", name == null ? "Original media" : name)
                    .put("size", size)
                    .put("mimeType", mime == null ? "application/octet-stream" : mime)
                    .put("persistent", persistent);
            final JSONObject record = new JSONObject(item.toString()).put("uri", uri.toString());
            repository()
                .store
                .edit(
                    state -> {
                      JSONObject picks = state.optJSONObject("selections");
                      if (picks == null) {
                        picks = new JSONObject();
                        state.put("selections", picks);
                      }
                      picks.put(id, record);
                    });
            files.put(item);
          }
          call.resolve(new JSObject().put("files", files));
        });
  }

  @PluginMethod
  public void getSelectionPreview(PluginCall call) {
    work(
        call,
        () -> {
          JSONObject selected =
              repository()
                  .store
                  .snapshot()
                  .getJSONObject("selections")
                  .getJSONObject(call.getString("id"));
          String mime = selected.getString("mimeType");
          if (!mime.startsWith("image/")) {
            call.resolve(new JSObject().put("thumbnail", ""));
            return;
          }
          Uri uri = Uri.parse(selected.getString("uri"));
          BitmapFactory.Options bounds = new BitmapFactory.Options();
          bounds.inJustDecodeBounds = true;
          try (InputStream input = getContext().getContentResolver().openInputStream(uri)) {
            BitmapFactory.decodeStream(input, null, bounds);
          }
          if (bounds.outWidth <= 0 || bounds.outHeight <= 0) {
            call.resolve(new JSObject().put("thumbnail", ""));
            return;
          }
          BitmapFactory.Options options = new BitmapFactory.Options();
          options.inSampleSize = Math.max(1, Math.max(bounds.outWidth, bounds.outHeight) / 320);
          Bitmap bitmap;
          try (InputStream input = getContext().getContentResolver().openInputStream(uri)) {
            bitmap = BitmapFactory.decodeStream(input, null, options);
          }
          String thumbnail = "";
          if (bitmap != null) {
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            bitmap.compress(Bitmap.CompressFormat.JPEG, 65, bytes);
            bitmap.recycle();
            if (bytes.size() < 300000)
              thumbnail =
                  "data:image/jpeg;base64,"
                      + Base64.getEncoder().encodeToString(bytes.toByteArray());
          }
          call.resolve(new JSObject().put("thumbnail", thumbnail));
        });
  }

  @PluginMethod
  public void uploadObject(PluginCall call) {
    authenticated(
        call,
        () -> {
          String slot = R2Policy.slot(call.getString("slot"));
          R2Repository repository = repository();
          R2Credentials credentials = repository.store.credentials(slot);
          JSONObject selected =
              repository
                  .store
                  .snapshot()
                  .getJSONObject("selections")
                  .getJSONObject(call.getString("selectionId"));
          if (slot.equals("private") && !repository.store.snapshot().optBoolean("recoveryVerified"))
            throw new R2Exception("RECOVERY_REQUIRED");
          if (!selected.optBoolean("persistent")) throw new R2Exception("PERSISTENT_URI_REQUIRED");
          String id = UUID.randomUUID().toString();
          String mime = selected.getString("mimeType");
          JSONObject job =
              new JSONObject()
                  .put("id", id)
                  .put("slot", slot)
                  .put("key", R2Policy.objectKey(slot, mime))
                  .put("revision", credentials.revision)
                  .put("source", selected.getString("uri"))
                  .put("name", selected.getString("name"))
                  .put("mimeType", mime)
                  .put("size", selected.optLong("size"))
                  .put("status", "queued")
                  .put("direction", "upload")
                  .put("stripMetadata", call.getBoolean("stripMetadata", false))
                  .put("createdAt", System.currentTimeMillis())
                  .put("uploadedBytes", 0)
                  .put("totalBytes", selected.optLong("size"));
          repository.job(job);
          R2TransferWorker.enqueue(getContext(), id);
          call.resolve(js(repository.safeJob(job)));
        });
  }

  @PluginMethod
  public void getTransferProgress(PluginCall call) {
    work(
        call,
        () -> {
          R2Repository repository = repository();
          JSONArray stored = repository.jobs(), safe = new JSONArray();
          for (int i = 0; i < stored.length(); i++)
            safe.put(repository.safeJob(stored.getJSONObject(i)));
          call.resolve(new JSObject().put("transfers", safe));
        });
  }

  @PluginMethod
  public void resumeTransfer(PluginCall call) {
    authenticated(
        call,
        () -> {
          String id = call.getString("id");
          R2Repository repository = repository();
          JSONObject job = repository.job(id);
          if (!Set.of("paused", "interrupted", "failed").contains(job.optString("status")))
            throw new R2Exception("TRANSFER_NOT_RESUMABLE");
          repository.checkCredentialRevision(job);
          repository.update(id, j -> j.put("status", "queued").remove("error"));
          R2TransferWorker.enqueue(getContext(), id);
          call.resolve();
        });
  }

  @PluginMethod
  public void pauseTransfer(PluginCall call) {
    work(
        call,
        () -> {
          String id = call.getString("id");
          repository().update(id, j -> j.put("status", "paused"));
          call.resolve();
        });
  }

  @PluginMethod
  public void cancelTransfer(PluginCall call) {
    authenticated(
        call,
        () -> {
          String id = call.getString("id");
          R2Repository repository = repository();
          JSONObject job = repository.job(id);
          if (job.optString("status").equals("complete"))
            throw new R2Exception("TRANSFER_ALREADY_COMPLETE");
          repository.update(id, j -> j.put("status", "cancelling"));
          // Soft cancellation preserves the rest of the WorkManager chain. An
          // interrupted worker repeats cleanup after its in-flight request settles.
          repository.cleanupCancelled(id);
          call.resolve();
        });
  }

  @PluginMethod
  public void downloadObject(PluginCall call) {
    authenticated(
        call,
        () -> {
          String slot = R2Policy.slot(call.getString("slot"));
          repository().store.credentials(slot);
          R2Policy.key(call.getString("key"));
          getActivity()
              .runOnUiThread(
                  () -> {
                    Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType("application/octet-stream");
                    intent.putExtra(
                        Intent.EXTRA_TITLE, call.getString("name", "atlas-original.bin"));
                    intent.addFlags(
                        Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                            | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
                    startActivityForResult(call, intent, "downloadDestination");
                  });
        });
  }

  @ActivityCallback
  private void downloadDestination(PluginCall call, ActivityResult result) {
    if (call == null) return;
    work(
        call,
        () -> {
          Uri destination = result.getData() == null ? null : result.getData().getData();
          if (result.getResultCode() != Activity.RESULT_OK || destination == null) {
            call.resolve(new JSObject().put("cancelled", true));
            return;
          }
          getContext()
              .getContentResolver()
              .takePersistableUriPermission(destination, Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
          String slot = R2Policy.slot(call.getString("slot")), id = UUID.randomUUID().toString();
          R2Repository repository = repository();
          JSONObject job =
              new JSONObject()
                  .put("id", id)
                  .put("slot", slot)
                  .put("key", R2Policy.key(call.getString("key")))
                  .put("revision", repository.store.credentials(slot).revision)
                  .put("destination", destination.toString())
                  .put("name", call.getString("name", "atlas-original.bin"))
                  .put("mimeType", "application/octet-stream")
                  .put("status", "queued")
                  .put("direction", "download")
                  .put("createdAt", System.currentTimeMillis());
          repository.job(job);
          R2TransferWorker.enqueue(getContext(), id);
          call.resolve(js(repository.safeJob(job)));
        });
  }

  @PluginMethod
  public void createRecoveryKit(PluginCall call) {
    char[] password = call.getString("passphrase", "").toCharArray();
    call.getData().remove("passphrase");
    authenticated(
        call,
        () -> {
          R2Repository repository = repository();
          if (!repository.store.snapshot().has("keyset")) {
            byte[] keyset = R2Crypto.newKeyset();
            try {
              repository.store.edit(
                  state ->
                      state
                          .put("keyset", Base64.getEncoder().encodeToString(keyset))
                          .put("recoveryVerified", false));
            } finally {
              Arrays.fill(keyset, (byte) 0);
            }
          }
          byte[] keyset = repository.keyset();
          try {
            pendingKit = R2Crypto.recoveryKit(keyset, password);
          } finally {
            Arrays.fill(keyset, (byte) 0);
            Arrays.fill(password, '\0');
          }
          getActivity()
              .runOnUiThread(
                  () -> {
                    Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType("application/json");
                    intent.putExtra(Intent.EXTRA_TITLE, "life-atlas-r2-recovery.atlasr2key");
                    startActivityForResult(call, intent, "recoverySaved");
                  });
        });
  }

  @ActivityCallback
  private void recoverySaved(PluginCall call, ActivityResult result) {
    if (call == null) return;
    work(
        call,
        () -> {
          byte[] kit = pendingKit;
          pendingKit = null;
          try {
            Uri uri = result.getData() == null ? null : result.getData().getData();
            if (result.getResultCode() != Activity.RESULT_OK || uri == null || kit == null)
              throw new R2Exception("RECOVERY_EXPORT_CANCELLED");
            try (OutputStream output = getContext().getContentResolver().openOutputStream(uri)) {
              if (output == null) throw new R2Exception("DESTINATION_UNAVAILABLE");
              output.write(kit);
            }
            call.resolve(new JSObject().put("saved", true).put("verified", false));
          } finally {
            if (kit != null) Arrays.fill(kit, (byte) 0);
          }
        });
  }

  @PluginMethod
  public void restoreRecoveryKit(PluginCall call) {
    char[] password = call.getString("passphrase", "").toCharArray();
    call.getData().remove("passphrase");
    authenticated(
        call,
        () -> {
          if (recoveryPassword != null) Arrays.fill(recoveryPassword, '\0');
          recoveryPassword = password;
          getActivity()
              .runOnUiThread(
                  () -> {
                    Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType("*/*");
                    startActivityForResult(call, intent, "recoveryOpened");
                  });
        });
  }

  @ActivityCallback
  private void recoveryOpened(PluginCall call, ActivityResult result) {
    if (call == null) return;
    work(
        call,
        () -> {
          char[] password = recoveryPassword;
          recoveryPassword = null;
          try {
            Uri uri = result.getData() == null ? null : result.getData().getData();
            if (result.getResultCode() != Activity.RESULT_OK || uri == null || password == null)
              throw new R2Exception("RECOVERY_IMPORT_CANCELLED");
            byte[] keyset;
            try (InputStream input = getContext().getContentResolver().openInputStream(uri)) {
              if (input == null) throw new R2Exception("SOURCE_UNAVAILABLE");
              keyset = R2Crypto.restoreKit(R2Io.read(input, 65536), password);
            }
            try {
              R2Repository repository = repository();
              JSONObject state = repository.store.snapshot();
              if (state.has("keyset") && !MessageDigest.isEqual(keyset, repository.keyset()))
                throw new R2Exception("DIFFERENT_RECOVERY_KEY");
              repository.store.edit(
                  value ->
                      value
                          .put("keyset", Base64.getEncoder().encodeToString(keyset))
                          .put("recoveryVerified", true));
              call.resolve(new JSObject().put("verified", true));
            } finally {
              Arrays.fill(keyset, (byte) 0);
            }
          } finally {
            if (password != null) Arrays.fill(password, '\0');
          }
        });
  }

  @PluginMethod
  public void getPublicCatalog(PluginCall call) {
    work(
        call,
        () -> {
          R2Catalog catalog = new R2Catalog(repository().store.credentials("public"));
          call.resolve(js(catalog.result(catalog.read())));
        });
  }

  @PluginMethod
  public void publishMedia(PluginCall call) {
    authenticated(
        call,
        () -> {
          R2Repository repository = repository();
          JSONObject job = repository.job(call.getString("transferId"));
          R2Catalog catalog = new R2Catalog(repository.store.credentials("public"));
          call.resolve(js(catalog.result(catalog.publish(job, call.getData()))));
        });
  }

  @PluginMethod
  public void unpublishMedia(PluginCall call) {
    authenticated(
        call,
        () -> {
          R2Catalog catalog = new R2Catalog(repository().store.credentials("public"));
          call.resolve(js(catalog.result(catalog.unpublish(call.getString("id")))));
        });
  }

  @PluginMethod
  public void deleteObjects(PluginCall call) {
    authenticated(
        call,
        () -> {
          String slot = R2Policy.slot(call.getString("slot"));
          JSONArray keys = call.getArray("keys");
          if (keys == null || keys.length() > 100 || keys.length() == 0)
            throw new R2Exception("INVALID_SELECTION");
          R2Credentials credentials = repository().store.credentials(slot);
          R2Client client = new R2Client(credentials);
          R2Catalog catalog = slot.equals("public") ? new R2Catalog(credentials) : null;
          Set<String> published = new HashSet<>();
          if (catalog != null) {
            JSONArray items = catalog.read().getJSONArray("items");
            for (int i = 0; i < items.length(); i++)
              published.add(items.getJSONObject(i).getString("key"));
          }
          for (int i = 0; i < keys.length(); i++) {
            String key = R2Policy.key(keys.getString(i));
            if (key.startsWith("atlas/catalog/")) throw new R2Exception("CATALOG_DELETE_BLOCKED");
            if (published.contains(key)) throw new R2Exception("PUBLISHED_OBJECT");
          }
          JSONArray deleted = new JSONArray();
          for (int i = 0; i < keys.length(); i++) {
            String key = keys.getString(i);
            client.delete(key);
            deleted.put(key);
          }
          call.resolve(new JSObject().put("deleted", deleted));
        });
  }

  @PluginMethod
  public void getObjectPreview(PluginCall call) {
    authenticated(
        call,
        () -> {
          String slot = R2Policy.slot(call.getString("slot")),
              key = R2Policy.key(call.getString("key"));
          R2Repository repository = repository();
          R2Client client = new R2Client(repository.store.credentials(slot));
          JSONObject meta = client.head(key);
          if (meta.getLong("size") > 32L * 1024 * 1024) throw new R2Exception("PREVIEW_TOO_LARGE");
          File raw = File.createTempFile("r2-preview-", ".tmp", getContext().getCacheDir()),
              plain = File.createTempFile("r2-plain-", ".tmp", getContext().getCacheDir());
          try {
            try (R2Client.Response response =
                    client.request(
                        "GET", key, Collections.emptyMap(), Collections.emptyMap(), null, null);
                OutputStream output = new FileOutputStream(raw)) {
              byte[] buffer = new byte[65536];
              int n;
              long total = 0;
              while ((n = response.input.read(buffer)) != -1) {
                total += n;
                if (total > 32L * 1024 * 1024) throw new R2Exception("PREVIEW_TOO_LARGE");
                output.write(buffer, 0, n);
              }
            }
            if (!meta.optString("sha256").isEmpty()
                && !R2Io.sha(raw).equals(meta.getString("sha256")))
              throw new R2Exception("INTEGRITY_FAILED");
            File picture = raw;
            if (slot.equals("private")) {
              byte[] keyset = repository.keyset();
              try (InputStream input = new FileInputStream(raw);
                  OutputStream output = new FileOutputStream(plain)) {
                R2Envelope.decrypt(input, output, keyset, key);
              } finally {
                Arrays.fill(keyset, (byte) 0);
              }
              picture = plain;
            }
            BitmapFactory.Options bounds = new BitmapFactory.Options();
            bounds.inJustDecodeBounds = true;
            BitmapFactory.decodeFile(picture.getAbsolutePath(), bounds);
            if (bounds.outWidth <= 0 || bounds.outHeight <= 0)
              throw new R2Exception("PREVIEW_UNAVAILABLE");
            BitmapFactory.Options options = new BitmapFactory.Options();
            options.inSampleSize = Math.max(1, Math.max(bounds.outWidth, bounds.outHeight) / 1000);
            Bitmap bitmap = BitmapFactory.decodeFile(picture.getAbsolutePath(), options);
            if (bitmap == null) throw new R2Exception("PREVIEW_UNAVAILABLE");
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            bitmap.compress(Bitmap.CompressFormat.JPEG, 75, bytes);
            bitmap.recycle();
            if (bytes.size() > 1500000) throw new R2Exception("PREVIEW_UNAVAILABLE");
            call.resolve(
                new JSObject()
                    .put(
                        "thumbnail",
                        "data:image/jpeg;base64,"
                            + Base64.getEncoder().encodeToString(bytes.toByteArray())));
          } finally {
            raw.delete();
            plain.delete();
          }
        });
  }

  @PluginMethod
  public void createPublicCopy(PluginCall call) {
    authenticated(
        call,
        () -> {
          String key = R2Policy.key(call.getString("key"));
          R2Repository repository = repository();
          R2Client client = new R2Client(repository.store.credentials("private"));
          File encrypted = File.createTempFile("r2-private-", ".tmp", getContext().getCacheDir()),
              plain = File.createTempFile("r2-public-copy-", ".tmp", getContext().getCacheDir());
          boolean ready = false;
          try {
            JSONObject meta = client.head(key);
            if (meta.getLong("size") + 128L * 1024 * 1024
                > getContext().getCacheDir().getUsableSpace())
              throw new R2Exception("INSUFFICIENT_DEVICE_SPACE");
            try (R2Client.Response response =
                    client.request(
                        "GET", key, Collections.emptyMap(), Collections.emptyMap(), null, null);
                OutputStream output = new FileOutputStream(encrypted)) {
              byte[] buffer = new byte[65536];
              int n;
              while ((n = response.input.read(buffer)) != -1) output.write(buffer, 0, n);
            }
            if (!meta.optString("sha256").equals(R2Io.sha(encrypted)))
              throw new R2Exception("INTEGRITY_FAILED");
            byte[] keyset = repository.keyset();
            JSONObject original;
            try (InputStream input = new FileInputStream(encrypted);
                OutputStream output = new FileOutputStream(plain)) {
              original = R2Envelope.decrypt(input, output, keyset, key);
            } finally {
              Arrays.fill(keyset, (byte) 0);
            }
            String id = UUID.randomUUID().toString();
            Uri uri =
                androidx.core.content.FileProvider.getUriForFile(
                    getContext(), getContext().getPackageName() + ".fileprovider", plain);
            JSONObject item =
                new JSONObject()
                    .put("id", id)
                    .put("name", original.getString("name"))
                    .put("mimeType", original.getString("mimeType"))
                    .put("size", original.getLong("size"))
                    .put("persistent", true);
            JSONObject record =
                new JSONObject(item.toString())
                    .put("uri", uri.toString())
                    .put("temporaryPublicCopy", true);
            repository.store.edit(
                state -> {
                  JSONObject picks = state.optJSONObject("selections");
                  if (picks == null) {
                    picks = new JSONObject();
                    state.put("selections", picks);
                  }
                  picks.put(id, record);
                });
            ready = true;
            call.resolve(js(item));
          } finally {
            encrypted.delete();
            if (!ready) plain.delete();
          }
        });
  }

  private JSONObject manualMultipart(String id) throws Exception {
    JSONObject job = repository().job(id);
    if (!job.optString("status").equals("paused")
        || job.optString("direction").equals("download")
        || !repository().staging(id).exists()
        || !job.has("sha256")) throw new R2Exception("PAUSE_PREPARED_TRANSFER_FIRST");
    repository().checkCredentialRevision(job);
    return job;
  }

  @PluginMethod
  public void startMultipartUpload(PluginCall call) {
    authenticated(
        call,
        () -> {
          String id = call.getString("id");
          JSONObject job = manualMultipart(id);
          if (job.optString("uploadId").isEmpty()) {
            String uploadId =
                new R2Client(repository().store.credentials(job.getString("slot")))
                    .startMultipart(job.getString("key"), repository().metadata(job));
            repository().update(id, j -> j.put("uploadId", uploadId).put("parts", new JSONArray()));
          }
          call.resolve(new JSObject().put("started", true));
        });
  }

  @PluginMethod
  public void uploadMultipartPart(PluginCall call) {
    authenticated(
        call,
        () -> {
          String id = call.getString("id");
          JSONObject job = manualMultipart(id);
          int number = call.getInt("number", 0);
          JSONArray parts = job.optJSONArray("parts");
          if (parts == null || number != parts.length() + 1 || number < 1 || number > 10000)
            throw new R2Exception("INVALID_PART_NUMBER");
          File file = repository().staging(id);
          long size = R2Policy.partSize(file.length()), offset = (number - 1) * size;
          if (offset >= file.length()) throw new R2Exception("INVALID_PART_NUMBER");
          String etag =
              new R2Client(repository().store.credentials(job.getString("slot")))
                  .part(
                      job.getString("key"),
                      job.getString("uploadId"),
                      number,
                      R2Client.file(file, offset, Math.min(size, file.length() - offset)),
                      null);
          parts.put(new JSONObject().put("number", number).put("etag", etag));
          repository().update(id, j -> j.put("parts", parts));
          call.resolve(new JSObject().put("number", number));
        });
  }

  @PluginMethod
  public void completeMultipartUpload(PluginCall call) {
    authenticated(
        call,
        () -> {
          String id = call.getString("id");
          JSONObject job = manualMultipart(id);
          long expected =
              (repository().staging(id).length()
                      + R2Policy.partSize(repository().staging(id).length())
                      - 1)
                  / R2Policy.partSize(repository().staging(id).length());
          JSONArray parts = job.getJSONArray("parts");
          if (parts.length() != expected) throw new R2Exception("INCOMPLETE_MULTIPART_UPLOAD");
          new R2Client(repository().store.credentials(job.getString("slot")))
              .complete(job.getString("key"), job.getString("uploadId"), parts);
          repository().update(id, j -> j.put("status", "queued"));
          R2TransferWorker.enqueue(getContext(), id);
          call.resolve(new JSObject().put("verifying", true));
        });
  }

  @PluginMethod
  public void abortMultipartUpload(PluginCall call) {
    cancelTransfer(call);
  }

  @PluginMethod
  public void resetUnavailableKeystore(PluginCall call) {
    authenticated(
        call,
        () -> {
          WorkManager.getInstance(getContext()).cancelAllWorkByTag("atlas-r2").getResult().get();
          R2SecureStore.resetUnavailable(getContext());
          call.resolve();
        });
  }

  @Override
  protected void handleOnDestroy() {
    if (recoveryPassword != null) Arrays.fill(recoveryPassword, '\0');
    if (pendingKit != null) Arrays.fill(pendingKit, (byte) 0);
    selections.clear();
    super.handleOnDestroy();
  }
}
