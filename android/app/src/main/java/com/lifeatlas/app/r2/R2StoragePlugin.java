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
import androidx.work.WorkManager;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;
import java.io.*;
import java.security.MessageDigest;
import java.util.*;
import org.json.*;

@CapacitorPlugin(
    name = "AtlasR2Storage",
    permissions = {
      @Permission(
          alias = "galleryImages",
          strings = {"android.permission.READ_MEDIA_IMAGES"}),
      @Permission(
          alias = "galleryVideos",
          strings = {"android.permission.READ_MEDIA_VIDEO"}),
      @Permission(
          alias = "galleryLimited",
          strings = {"android.permission.READ_MEDIA_VISUAL_USER_SELECTED"}),
      @Permission(
          alias = "galleryOriginal",
          strings = {"android.permission.ACCESS_MEDIA_LOCATION"}),
      @Permission(
          alias = "galleryLegacy",
          strings = {"android.permission.READ_EXTERNAL_STORAGE"})
    })
public class R2StoragePlugin extends Plugin {
  interface Task {
    void run() throws Exception;
  }

  private final java.util.concurrent.atomic.AtomicLong gallerySearchGeneration =
      new java.util.concurrent.atomic.AtomicLong();
  private final R2PublicationSession publicationSession = new R2PublicationSession();
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
    String slot = call.getString("slot", "public");
    try {
      if (Set.of("startMultipartUpload", "uploadMultipartPart", "completeMultipartUpload")
          .contains(call.getMethodName()))
        slot = repository().job(call.getString("id")).optString("slot", "public");
    } catch (Exception error) {
      fail(call, error);
      return;
    }
    com.lifeatlas.app.security.AtlasSecurity.require(
        getActivity(),
        com.lifeatlas.app.security.AtlasSecurity.storageScope(call.getMethodName(), slot),
        false,
        () -> work(call, task),
        code -> call.reject(code, code));
  }

  /** Only explicitly enumerated public trip operations may reuse this batch authentication. */
  private void tripAuthorized(PluginCall call, Task check, Task task) {
    if (call.getString("publicationSession") == null) {
      authenticated(call, task);
      return;
    }
    work(
        call,
        () -> {
          check.run();
          task.run();
        });
  }

  private JSONObject galleryAccess() throws Exception {
    return R2GalleryAccess.describe(
        Build.VERSION.SDK_INT,
        getPermissionState("galleryLegacy") == PermissionState.GRANTED,
        getPermissionState("galleryImages") == PermissionState.GRANTED,
        getPermissionState("galleryVideos") == PermissionState.GRANTED,
        getPermissionState("galleryLimited") == PermissionState.GRANTED);
  }

  @PluginMethod
  public void getGalleryAccess(PluginCall call) {
    work(call, () -> call.resolve(js(galleryAccess())));
  }

  @PluginMethod
  public void requestGalleryAccess(PluginCall call) {
    try {
      guard();
    } catch (Exception e) {
      fail(call, e);
      return;
    }
    String[] aliases =
        Build.VERSION.SDK_INT >= 34
            ? new String[] {"galleryImages", "galleryVideos", "galleryLimited"}
            : Build.VERSION.SDK_INT >= 33
                ? new String[] {"galleryImages", "galleryVideos"}
                : new String[] {"galleryLegacy"};
    requestPermissionForAliases(aliases, call, "galleryPermissionResult");
  }

  @PermissionCallback
  private void galleryPermissionResult(PluginCall call) {
    getGalleryAccess(call);
  }

  @PluginMethod
  public void openGallerySettings(PluginCall call) {
    work(
        call,
        () -> {
          Intent intent =
              new Intent(
                      android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                      Uri.parse("package:" + getContext().getPackageName()))
                  .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
          getContext().startActivity(intent);
          call.resolve();
        });
  }

  @PluginMethod
  public void getGalleryRecovery(PluginCall call) {
    work(
        call,
        () -> call.resolve(js(GalleryRecovery.status(new GalleryIntelligence(getContext())))));
  }

  @PluginMethod
  public void configureGalleryRecovery(PluginCall call) {
    if (Boolean.TRUE.equals(call.getBoolean("enabled"))
        && Build.VERSION.SDK_INT >= 29
        && getPermissionState("galleryOriginal") != PermissionState.GRANTED) {
      requestPermissionForAlias("galleryOriginal", call, "galleryRecoveryPermission");
      return;
    }
    authenticated(
        call,
        () ->
            call.resolve(
                js(
                    GalleryRecovery.configure(
                        getContext(), Boolean.TRUE.equals(call.getBoolean("enabled"))))));
  }

  @PermissionCallback
  private void galleryRecoveryPermission(PluginCall call) {
    if (getPermissionState("galleryOriginal") != PermissionState.GRANTED) {
      call.reject("ORIGINAL_MEDIA_ACCESS_REQUIRED", "ORIGINAL_MEDIA_ACCESS_REQUIRED");
      return;
    }
    configureGalleryRecovery(call);
  }

  @PluginMethod
  public void controlGalleryRecovery(PluginCall call) {
    if (!Set.of("cancel", "verify").contains(call.getString("action", ""))
        && Build.VERSION.SDK_INT >= 29
        && getPermissionState("galleryOriginal") != PermissionState.GRANTED) {
      requestPermissionForAlias("galleryOriginal", call, "galleryRecoveryControlPermission");
      return;
    }
    authenticated(
        call,
        () -> {
          String action = call.getString("action", "");
          if (!Set.of("backup", "restore", "cancel", "verify").contains(action))
            throw new R2Exception("INVALID_SELECTION");
          if (action.equals("cancel")) {
            WorkManager.getInstance(getContext()).cancelUniqueWork(GalleryRecoveryWorker.WORK);
            GalleryRecovery.progress(new GalleryIntelligence(getContext()), "paused", 0, 0, "");
          } else {
            if (action.equals("restore")) {
              new GalleryIntelligence(getContext()).control("pause");
              try (GallerySearchStore db =
                  new GallerySearchStore(new GalleryIntelligence(getContext()).secure)) {
                JSONObject state = db.choice("recovery-settings");
                state.put(
                    "denyRecoveredFaces", !Boolean.TRUE.equals(call.getBoolean("peopleApproved")));
                db.choice("recovery-settings", state);
              }
            }
            GalleryRecoveryWorker.schedule(
                getContext(), action, Boolean.TRUE.equals(call.getBoolean("peopleApproved")));
          }
          call.resolve();
        });
  }

  @PermissionCallback
  private void galleryRecoveryControlPermission(PluginCall call) {
    if (getPermissionState("galleryOriginal") != PermissionState.GRANTED) {
      call.reject("ORIGINAL_MEDIA_ACCESS_REQUIRED", "ORIGINAL_MEDIA_ACCESS_REQUIRED");
      return;
    }
    controlGalleryRecovery(call);
  }

  @PluginMethod
  public void getGalleryMediaPreferences(PluginCall call) {
    work(
        call,
        () -> {
          try (GallerySearchStore db =
              new GallerySearchStore(new GalleryIntelligence(getContext()).secure)) {
            call.resolve(js(db.choice("media-preferences")));
          }
        });
  }

  @PluginMethod
  public void saveGalleryMediaPreferences(PluginCall call) {
    work(
        call,
        () -> {
          JSONArray ids = call.getArray("favorites");
          if (ids == null || ids.length() > 100000) throw new R2Exception("INVALID_SELECTION");
          try (GallerySearchStore db =
              new GallerySearchStore(new GalleryIntelligence(getContext()).secure)) {
            JSONObject prefs = db.choice("media-preferences");
            prefs.put("favorites", ids);
            db.choice("media-preferences", prefs);
          }
          GalleryRecoveryWorker.scheduleIfEnabled(getContext());
          call.resolve();
        });
  }

  @PluginMethod
  public void getGalleryViewerState(PluginCall call) {
    work(
        call,
        () ->
            call.resolve(
                js(
                    GalleryMediaTools.viewer(
                        getContext(), repository().store, call.getString("id", "")))));
  }

  @PluginMethod
  public void saveGalleryVideoState(PluginCall call) {
    work(
        call,
        () -> {
          GalleryMediaTools.videoState(getContext(), repository().store, call.getData());
          GalleryRecoveryWorker.scheduleIfEnabled(getContext());
          call.resolve();
        });
  }

  @PluginMethod
  public void getGalleryVideoFrames(PluginCall call) {
    work(
        call,
        () -> call.resolve(js(GalleryMediaTools.frames(getContext(), call.getString("id", "")))));
  }

  @PluginMethod
  public void getGalleryMotionPhoto(PluginCall call) {
    work(
        call,
        () ->
            call.resolve(
                js(
                    GalleryMotionPhoto.inspect(
                        getContext(),
                        call.getString("id", ""),
                        call.getBoolean("extract", false)))));
  }

  @PluginMethod
  public void editGalleryPhoto(PluginCall call) {
    work(
        call,
        () -> {
          JSONObject result =
              GalleryMediaTools.edit(getContext(), repository().store, call.getData());
          GalleryRecoveryWorker.scheduleIfEnabled(getContext());
          call.resolve(js(result));
        });
  }

  @PluginMethod
  public void getGalleryCache(PluginCall call) {
    work(
        call,
        () -> call.resolve(js(GalleryMediaTools.cacheReport(getContext(), repository().store))));
  }

  @PluginMethod
  public void configureGalleryCache(PluginCall call) {
    work(
        call,
        () -> {
          GalleryMediaTools.cacheSettings(getContext(), repository().store, call.getData());
          call.resolve(js(GalleryMediaTools.cacheReport(getContext(), repository().store)));
        });
  }

  @PluginMethod
  public void shareSanitizedMedia(PluginCall call) {
    work(
        call,
        () -> {
          File file = GalleryMediaTools.sanitized(getContext(), call.getString("id", ""));
          android.net.Uri uri =
              androidx.core.content.FileProvider.getUriForFile(
                  getContext(), getContext().getPackageName() + ".fileprovider", file);
          Intent share =
              new Intent(Intent.ACTION_SEND)
                  .setType(file.getName().endsWith(".mp4") ? "video/mp4" : "image/jpeg")
                  .putExtra(Intent.EXTRA_STREAM, uri)
                  .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
          share.setClipData(ClipData.newUri(getContext().getContentResolver(), "Shared copy", uri));
          getActivity()
              .runOnUiThread(
                  () -> {
                    try {
                      launchGalleryShare(
                          call, Intent.createChooser(share, "Share without location"));
                    } catch (Exception e) {
                      fail(call, e);
                    }
                  });
        });
  }

  @PluginMethod
  public void shareGalleryPreview(PluginCall call) {
    work(
        call,
        () -> {
          if (!galleryForeground) throw new R2Exception("AUTHENTICATION_REQUIRED");
          Intent intent =
              GalleryMediaActions.sharePreview(getContext(), call.getString("token", ""));
          getActivity()
              .runOnUiThread(
                  () -> {
                    try {
                      launchGalleryShare(call, intent);
                    } catch (Exception e) {
                      fail(call, e);
                    }
                  });
        });
  }

  @PluginMethod
  public void shareDeviceMedia(PluginCall call) {
    work(
        call,
        () -> {
          Intent intent = GalleryMediaActions.share(getContext(), call.getArray("ids"));
          getActivity()
              .runOnUiThread(
                  () -> {
                    try {
                      launchGalleryShare(call, intent);
                    } catch (Exception e) {
                      fail(call, e);
                    }
                  });
        });
  }

  private void launchGalleryShare(PluginCall call, Intent chooser) throws Exception {
    if (!"whatsapp".equals(call.getString("target", ""))) {
      startActivityForResult(call, chooser, "galleryShareResult");
      return;
    }
    Intent intent = chooser.getParcelableExtra(Intent.EXTRA_INTENT);
    if (intent == null) throw new R2Exception("INVALID_SELECTION");
    intent.setPackage("com.whatsapp");
    try {
      startActivityForResult(call, intent, "galleryShareResult");
    } catch (android.content.ActivityNotFoundException missing) {
      try {
        intent.setPackage("com.whatsapp.w4b");
        startActivityForResult(call, intent, "galleryShareResult");
      } catch (android.content.ActivityNotFoundException absent) {
        throw new R2Exception("WHATSAPP_UNAVAILABLE");
      }
    }
  }

  @ActivityCallback
  private void galleryShareResult(PluginCall call, ActivityResult result) {
    if (call != null) call.resolve();
  }

  private volatile JSONObject pendingGalleryEdit;

  @PluginMethod
  public void editDeviceMedia(PluginCall call) {
    work(
        call,
        () -> {
          if (pendingGalleryEdit != null) throw new R2Exception("EDITOR_BUSY");
          JSONObject copy = GalleryMediaActions.editCopy(getContext(), call.getString("id", ""));
          Intent intent = GalleryMediaActions.editor(getContext(), copy);
          pendingGalleryEdit = copy;
          getActivity()
              .runOnUiThread(
                  () -> {
                    try {
                      startActivityForResult(call, intent, "galleryEditResult");
                    } catch (Exception e) {
                      pendingGalleryEdit = null;
                      try {
                        new File(copy.getString("path")).delete();
                      } catch (Exception ignored) {
                      }
                      fail(call, new R2Exception("EDITOR_UNAVAILABLE"));
                    }
                  });
        });
  }

  @ActivityCallback
  private void galleryEditResult(PluginCall call, ActivityResult result) {
    JSONObject copy = pendingGalleryEdit;
    pendingGalleryEdit = null;
    if (call == null || copy == null) return;
    execute(
        () -> {
          try {
            if (result.getResultCode() != Activity.RESULT_OK) {
              new File(copy.getString("path")).delete();
              call.resolve(new JSObject().put("saved", false));
              return;
            }
            call.resolve(
                js(
                    GalleryMediaActions.saveEdited(
                        getContext(),
                        copy,
                        result.getData() == null ? null : result.getData().getData())));
          } catch (Exception e) {
            try {
              new File(copy.getString("path")).delete();
            } catch (Exception ignored) {
            }
            fail(call, e);
          }
        });
  }

  @PluginMethod
  public void setDeviceMediaAs(PluginCall call) {
    work(
        call,
        () -> {
          JSONObject photo = new R2DeviceGallery(getContext()).one(call.getString("id", ""));
          if (!photo.getString("mimeType").startsWith("image/"))
            throw new R2Exception("EDIT_PHOTO_ONLY");
          Intent intent =
              new Intent(Intent.ACTION_ATTACH_DATA)
                  .setDataAndType(
                      R2DeviceGallery.uri(photo.getString("id")), photo.getString("mimeType"))
                  .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
          getActivity()
              .runOnUiThread(
                  () -> {
                    try {
                      startActivityForResult(
                          call, Intent.createChooser(intent, "Use photo as"), "galleryShareResult");
                    } catch (Exception e) {
                      fail(call, e);
                    }
                  });
        });
  }

  @PluginMethod
  public void freeUpDeviceMedia(PluginCall call) {
    if (Build.VERSION.SDK_INT >= 29
        && getPermissionState("galleryOriginal") != PermissionState.GRANTED) {
      requestPermissionForAlias("galleryOriginal", call, "galleryCleanupPermission");
      return;
    }
    authenticated(
        call,
        () -> {
          JSONArray verified =
              GallerySpace.verify(getContext(), repository(), call.getArray("ids"));
          call.getData().put("ids", verified).put("trashed", true);
          trashDeviceMedia(call);
        });
  }

  @PermissionCallback
  private void galleryCleanupPermission(PluginCall call) {
    if (getPermissionState("galleryOriginal") != PermissionState.GRANTED) {
      call.reject("ORIGINAL_MEDIA_ACCESS_REQUIRED", "ORIGINAL_MEDIA_ACCESS_REQUIRED");
      return;
    }
    freeUpDeviceMedia(call);
  }

  @PluginMethod
  public void editGalleryAlbum(PluginCall call) {
    work(
        call,
        () -> {
          try (GallerySearchStore db =
              new GallerySearchStore(new GalleryIntelligence(getContext()).secure)) {
            JSONObject result = GalleryAlbums.edit(getContext(), db, call.getData());
            GalleryRecoveryWorker.scheduleIfEnabled(getContext());
            call.resolve(js(result));
          }
        });
  }

  @PluginMethod
  public void getGalleryCollections(PluginCall call) {
    work(
        call,
        () -> {
          if (galleryAccess().getString("status").equals("denied"))
            throw new R2Exception("GALLERY_PERMISSION_REQUIRED");
          call.resolve(
              js(
                  new GalleryCollections(getContext())
                      .list(call.getString("kind", ""), call.getString("cursor", ""))));
        });
  }

  @PluginMethod
  public void getGalleryCollectionMedia(PluginCall call) {
    work(
        call,
        () -> {
          if (galleryAccess().getString("status").equals("denied"))
            throw new R2Exception("GALLERY_PERMISSION_REQUIRED");
          call.resolve(
              js(
                  new GalleryCollections(getContext())
                      .media(
                          call.getString("kind", ""),
                          call.getString("key", ""),
                          call.getString("cursor", ""))));
        });
  }

  @PluginMethod
  public void getGalleryPeopleFaces(PluginCall call) {
    work(
        call,
        () ->
            call.resolve(
                js(
                    new GalleryCollections(getContext())
                        .facePage(call.getString("key", ""), call.getString("cursor", "")))));
  }

  @PluginMethod
  public void getGalleryFaceThumbnail(PluginCall call) {
    work(
        call,
        () ->
            call.resolve(
                js(new GalleryCollections(getContext()).thumbnail(call.getString("faceId", "")))));
  }

  @PluginMethod
  public void editGalleryCollection(PluginCall call) {
    work(
        call,
        () -> {
          new GalleryCollections(getContext()).edit(call.getData());
          GalleryRecoveryWorker.scheduleIfEnabled(getContext());
          call.resolve();
        });
  }

  @PluginMethod
  public void resetGalleryAnalysisMetrics(PluginCall call) {
    work(
        call,
        () -> {
          synchronized (GalleryIntelligence.STATE_LOCK) {
            try (GallerySearchStore db =
                new GallerySearchStore(new GalleryIntelligence(getContext()).secure)) {
              db.forgetChoices("analysis-metrics-v1");
            }
          }
          call.resolve();
        });
  }

  @PluginMethod
  public void getGalleryAnalysisHealth(PluginCall call) {
    work(
        call,
        () ->
            call.resolve(js(GalleryAnalysisHealth.report(new GalleryIntelligence(getContext())))));
  }

  @PluginMethod
  public void prioritizeGalleryAnalysis(PluginCall call) {
    work(
        call,
        () ->
            call.resolve(
                js(
                    GalleryAnalysisHealth.request(
                        new GalleryIntelligence(getContext()), call.getString("id", ""), false))));
  }

  @PluginMethod
  public void getGalleryIntelligence(PluginCall call) {
    work(call, () -> call.resolve(js(new GalleryIntelligence(getContext()).status())));
  }

  @PluginMethod
  public void configureGalleryIntelligence(PluginCall call) {
    work(
        call,
        () -> {
          if (!call.getBoolean("approved", false)) throw new R2Exception("INVALID_SELECTION");
          if (!R2GalleryAccess.canAnalyze(galleryAccess()))
            throw new R2Exception("GALLERY_PERMISSION_REQUIRED");
          call.resolve(js(new GalleryIntelligence(getContext()).configure(call.getData())));
        });
  }

  @PluginMethod
  public void controlGalleryIntelligence(PluginCall call) {
    work(
        call,
        () ->
            call.resolve(
                js(new GalleryIntelligence(getContext()).control(call.getString("action", "")))));
  }

  @PluginMethod
  public void getGalleryNamedPeople(PluginCall call) {
    work(
        call,
        () -> {
          JSONArray result = new JSONArray();
          GalleryIntelligence intelligence = new GalleryIntelligence(getContext());
          if (intelligence.settings().optBoolean("people"))
            try (GallerySearchStore db = new GallerySearchStore(intelligence.secure)) {
              JSONObject choices = db.choice("people"),
                  names = choices.optJSONObject("people"),
                  aliases = choices.optJSONObject("aliases");
              Set<String> hidden = GalleryPeople.set(choices.optJSONArray("hidden"));
              if (names != null) {
                java.util.Iterator<String> ids = names.keys();
                while (ids.hasNext() && result.length() < 5000) {
                  String id = ids.next();
                  if ((aliases == null || !aliases.has(id)) && !hidden.contains(id))
                    result.put(new JSONObject().put("id", id).put("name", names.getString(id)));
                }
              }
            }
          call.resolve(new JSObject().put("people", result));
        });
  }

  @PluginMethod
  public void extractGalleryText(PluginCall call) {
    work(
        call,
        () ->
            call.resolve(
                js(
                    GalleryExtraction.text(
                        getContext(), repository().store, call.getString("id", "")))));
  }

  @PluginMethod
  public void createGallerySticker(PluginCall call) {
    work(
        call,
        () -> call.resolve(js(GallerySubjectInference.extract(getContext(), call.getData()))));
  }

  @PluginMethod
  public void saveGallerySticker(PluginCall call) {
    work(
        call,
        () -> {
          GalleryExtraction.save(getContext(), call.getString("token", ""));
          call.resolve();
        });
  }

  @PluginMethod
  public void copyGallerySticker(PluginCall call) {
    work(
        call,
        () -> {
          File file = GalleryExtraction.file(getContext(), call.getString("token", ""));
          Uri uri =
              androidx.core.content.FileProvider.getUriForFile(
                  getContext(), getContext().getPackageName() + ".fileprovider", file);
          ClipData clip = ClipData.newUri(getContext().getContentResolver(), "Atlas sticker", uri);
          getActivity()
              .runOnUiThread(
                  () -> {
                    try {
                      ((android.content.ClipboardManager)
                              getContext().getSystemService(Context.CLIPBOARD_SERVICE))
                          .setPrimaryClip(clip);
                      call.resolve();
                    } catch (Exception error) {
                      fail(call, error);
                    }
                  });
        });
  }

  @PluginMethod
  public void shareGallerySticker(PluginCall call) {
    work(
        call,
        () -> {
          File file = GalleryExtraction.file(getContext(), call.getString("token", ""));
          Uri uri =
              androidx.core.content.FileProvider.getUriForFile(
                  getContext(), getContext().getPackageName() + ".fileprovider", file);
          Intent send =
              new Intent(Intent.ACTION_SEND)
                  .setType("image/png")
                  .putExtra(Intent.EXTRA_STREAM, uri)
                  .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
          send.setClipData(ClipData.newUri(getContext().getContentResolver(), "Sticker", uri));
          getActivity()
              .runOnUiThread(
                  () -> {
                    try {
                      launchGalleryShare(call, Intent.createChooser(send, "Share sticker"));
                    } catch (Exception error) {
                      fail(call, error);
                    }
                  });
        });
  }

  @PluginMethod
  public void cancelGallerySearch(PluginCall call) {
    gallerySearchGeneration.incrementAndGet();
    call.resolve();
  }

  @PluginMethod
  public void saveGalleryCorrection(PluginCall call) {
    work(
        call,
        () -> {
          GalleryCorrections.save(new GalleryIntelligence(getContext()), call.getData());
          call.resolve();
        });
  }

  @PluginMethod
  public void listGalleryFavorites(PluginCall call) {
    work(
        call,
        () -> {
          JSONArray ids;
          try (GallerySearchStore db =
              new GallerySearchStore(new GalleryIntelligence(getContext()).secure)) {
            ids = db.choice("media-preferences").optJSONArray("favorites");
          }
          JSONArray items = new JSONArray();
          int offset = Math.max(0, call.getInt("offset", 0)),
              end = ids == null ? 0 : Math.min(ids.length(), offset + 80);
          R2DeviceGallery gallery = new R2DeviceGallery(getContext());
          for (int i = offset; i < end; i++)
            try {
              items.put(gallery.one(ids.getString(i)));
            } catch (Exception missing) {
            }
          call.resolve(
              js(
                  new JSONObject()
                      .put("items", items)
                      .put("cursor", ids != null && end < ids.length() ? String.valueOf(end) : "")
                      .put("complete", ids == null || end >= ids.length())));
        });
  }

  private final java.util.concurrent.atomic.AtomicBoolean galleryPreparing =
      new java.util.concurrent.atomic.AtomicBoolean();

  @PluginMethod
  public void prepareGallerySearch(PluginCall call) {
    work(
        call,
        () -> {
          if (!galleryForeground || !R2GalleryAccess.canAnalyze(galleryAccess()))
            throw new R2Exception("GALLERY_PERMISSION_REQUIRED");
          GalleryIntelligence intelligence = new GalleryIntelligence(getContext());
          if (!intelligence.settings().optBoolean("visual")
              || !GalleryClip.ready(getContext())
              || !galleryPreparing.compareAndSet(false, true)) {
            call.resolve();
            return;
          }
          try {
            GallerySearchInference.prepare(getContext(), () -> !galleryForeground);
            call.resolve();
          } finally {
            galleryPreparing.set(false);
          }
        });
  }

  @PluginMethod
  public void searchGalleryIntelligence(PluginCall call) {
    final long generation = gallerySearchGeneration.incrementAndGet();
    work(
        call,
        () -> {
          if (!R2GalleryAccess.canAnalyze(galleryAccess()))
            throw new R2Exception("GALLERY_PERMISSION_REQUIRED");
          call.resolve(
              js(
                  new GalleryIntelligence(getContext())
                      .search(
                          call.getString("query", ""),
                          call.getString("album", ""),
                          call.getString("kind", "all"),
                          call.getInt("offset", 0),
                          () -> generation != gallerySearchGeneration.get(),
                          call.getData(),
                          page -> {
                            String request = call.getString("requestId", "");
                            if (!request.isEmpty() && generation == gallerySearchGeneration.get())
                              notifyListeners(
                                  "gallerySearchResults", js(page.put("requestId", request)));
                          })));
        });
  }

  @PluginMethod
  public void listDeviceMedia(PluginCall call) {
    work(
        call,
        () -> {
          if (galleryAccess().getString("status").equals("denied"))
            throw new R2Exception("GALLERY_PERMISSION_REQUIRED");
          call.resolve(
              js(
                  new R2DeviceGallery(getContext())
                      .listBetween(
                          call.getString("cursor", ""),
                          call.getString("query", ""),
                          call.getString("kind", "all"),
                          call.getString("album", ""),
                          call.getString("order", "newest"),
                          call.getLong("from", 0L),
                          call.getLong("to", 0L))));
        });
  }

  @PluginMethod
  public void getGalleryAlbums(PluginCall call) {
    work(
        call,
        () ->
            call.resolve(new JSObject().put("albums", new R2DeviceGallery(getContext()).albums())));
  }

  @PluginMethod
  public void openNativeGalleryViewer(PluginCall call) {
    work(
        call,
        () -> {
          JSArray raw = call.getArray("ids");
          ArrayList<String> ids = new ArrayList<>();
          if (raw != null) for (int i = 0; i < raw.length(); i++) ids.add(raw.getString(i));
          GalleryNativeViewerActivity.validate(ids);
          String selected = call.getString("selected", "");
          if (!ids.contains(selected)) throw new R2Exception("INVALID_SELECTION");
          getActivity()
              .runOnUiThread(
                  () -> {
                    Intent intent = new Intent(getContext(), GalleryNativeViewerActivity.class);
                    intent.putStringArrayListExtra("ids", ids);
                    intent.putExtra("selected", selected);
                    startActivityForResult(call, intent, "nativeGalleryClosed");
                  });
        });
  }

  @ActivityCallback
  private void nativeGalleryClosed(PluginCall call, ActivityResult result) {
    if (call == null) return;
    Intent value = result.getData();
    if (result.getResultCode() != Activity.RESULT_OK || value == null) {
      call.resolve(new JSObject().put("action", "close"));
      return;
    }
    String id = value.getStringExtra("id");
    try {
      R2DeviceGallery.mediaNumber(id);
    } catch (Exception invalid) {
      call.reject("INVALID_SELECTION");
      return;
    }
    call.resolve(new JSObject().put("id", id).put("action", value.getStringExtra("action")));
  }

  @PluginMethod
  public void getDeviceThumbnail(PluginCall call) {
    work(
        call,
        () ->
            call.resolve(
                new JSObject()
                    .put(
                        "path",
                        new R2DeviceGallery(getContext())
                            .thumbnail(call.getString("id"), call.getInt("pixels", 768)))));
  }

  @PluginMethod
  public void registerDeviceMedia(PluginCall call) {
    try {
      guard();
    } catch (Exception e) {
      fail(call, e);
      return;
    }
    if (Build.VERSION.SDK_INT >= 29
        && getPermissionState("galleryOriginal") != PermissionState.GRANTED) {
      requestPermissionForAlias("galleryOriginal", call, "galleryOriginalRegistration");
      return;
    }
    work(
        call,
        () ->
            call.resolve(
                new JSObject()
                    .put(
                        "files",
                        new R2DeviceGallery(getContext())
                            .register(call.getArray("ids"), call.getObject("versions")))));
  }

  @PluginMethod
  public void checkDeviceCloud(PluginCall call) {
    try {
      guard();
    } catch (Exception e) {
      fail(call, e);
      return;
    }
    if (Build.VERSION.SDK_INT >= 29
        && getPermissionState("galleryOriginal") != PermissionState.GRANTED) {
      requestPermissionForAlias("galleryOriginal", call, "galleryOriginalCheck");
      return;
    }
    work(
        call,
        () ->
            call.resolve(
                new JSObject()
                    .put("items", new R2DeviceGallery(getContext()).check(call.getArray("ids")))));
  }

  @PermissionCallback
  private void galleryOriginalRegistration(PluginCall call) {
    if (getPermissionState("galleryOriginal") != PermissionState.GRANTED) {
      call.reject("ORIGINAL_MEDIA_ACCESS_REQUIRED", "ORIGINAL_MEDIA_ACCESS_REQUIRED");
      return;
    }
    registerDeviceMedia(call);
  }

  @PermissionCallback
  private void galleryOriginalCheck(PluginCall call) {
    if (getPermissionState("galleryOriginal") != PermissionState.GRANTED) {
      call.reject("ORIGINAL_MEDIA_ACCESS_REQUIRED", "ORIGINAL_MEDIA_ACCESS_REQUIRED");
      return;
    }
    checkDeviceCloud(call);
  }

  @PluginMethod
  public void readDeviceLocations(PluginCall call) {
    try {
      guard();
    } catch (Exception e) {
      fail(call, e);
      return;
    }
    if (Build.VERSION.SDK_INT >= 29
        && getPermissionState("galleryOriginal") != PermissionState.GRANTED) {
      requestPermissionForAlias("galleryOriginal", call, "galleryLocationPermission");
      return;
    }
    work(
        call,
        () ->
            call.resolve(
                new JSObject()
                    .put(
                        "items",
                        R2GalleryLocations.read(
                            getContext(),
                            call.getArray("ids"),
                            call.getObject("versions"),
                            false,
                            repository()))));
  }

  @PermissionCallback
  private void galleryLocationPermission(PluginCall call) {
    if (getPermissionState("galleryOriginal") != PermissionState.GRANTED) {
      call.reject("ORIGINAL_MEDIA_ACCESS_REQUIRED", "ORIGINAL_MEDIA_ACCESS_REQUIRED");
      return;
    }
    readDeviceLocations(call);
  }

  @PluginMethod
  public void fingerprintGalleryMedia(PluginCall call) {
    try {
      guard();
    } catch (Exception e) {
      fail(call, e);
      return;
    }
    if (Build.VERSION.SDK_INT >= 29
        && getPermissionState("galleryOriginal") != PermissionState.GRANTED) {
      requestPermissionForAlias("galleryOriginal", call, "galleryFingerprintPermission");
      return;
    }
    work(
        call,
        () ->
            call.resolve(
                new JSObject()
                    .put(
                        "items",
                        R2GalleryLocations.read(
                            getContext(),
                            call.getArray("ids"),
                            call.getObject("versions"),
                            true,
                            repository()))));
  }

  @PermissionCallback
  private void galleryFingerprintPermission(PluginCall call) {
    if (getPermissionState("galleryOriginal") != PermissionState.GRANTED) {
      call.reject("ORIGINAL_MEDIA_ACCESS_REQUIRED", "ORIGINAL_MEDIA_ACCESS_REQUIRED");
      return;
    }
    fingerprintGalleryMedia(call);
  }

  @PluginMethod
  public void backupPlaceCatalog(PluginCall call) {
    authenticated(
        call, () -> call.resolve(js(R2PlaceBackup.save(repository(), call.getObject("catalog")))));
  }

  @PluginMethod
  public void listPlaceBackups(PluginCall call) {
    authenticated(
        call,
        () -> {
          R2Repository repo = repository();
          byte[] keys = repo.keyset();
          try {
            call.resolve(
                js(
                    new R2Client(repo.store.credentials("private"))
                        .list(R2PlaceBackup.prefix(keys), call.getString("cursor", ""))));
          } finally {
            java.util.Arrays.fill(keys, (byte) 0);
          }
        });
  }

  @PluginMethod
  public void restorePlaceCatalog(PluginCall call) {
    authenticated(
        call,
        () ->
            call.resolve(
                new JSObject()
                    .put("catalog", R2PlaceBackup.restore(repository(), call.getString("key")))));
  }

  @PluginMethod
  public void openGalleryCloudPreview(PluginCall call) {
    authenticated(
        call,
        () -> {
          JSONObject result =
              R2GalleryPreview.open(getContext(), repository(), call.getString("key"));
          if (!galleryForeground || getActivity() == null || getActivity().isDestroyed()) {
            R2GalleryPreview.release(getContext(), result.getString("token"));
            throw new R2Exception("TRANSFER_INTERRUPTED");
          }
          call.resolve(js(result));
        });
  }

  @PluginMethod
  public void releaseGalleryPreview(PluginCall call) {
    work(
        call,
        () -> {
          R2GalleryPreview.release(getContext(), call.getString("token"));
          call.resolve();
        });
  }

  @PluginMethod
  public void queueGalleryUploads(PluginCall call) {
    authenticated(
        call,
        () -> {
          R2Repository repo = repository();
          String slot = R2Policy.slot(call.getString("slot"));
          R2Credentials credentials = repo.store.credentials(slot);
          if (slot.equals("private") && !repo.store.snapshot().optBoolean("recoveryVerified"))
            throw new R2Exception("RECOVERY_REQUIRED");
          JSONObject result =
              R2GalleryQueue.prepare(repo, credentials, slot, call.getArray("selectionIds"));
          JSONArray enqueue = result.getJSONArray("enqueue");
          R2TransferWorker.enqueueBatch(getContext(), enqueue);
          call.resolve(new JSObject().put("transferIds", result.getJSONObject("transferIds")));
        });
  }

  @PluginMethod
  public void beginTripPublication(PluginCall call) {
    authenticated(
        call,
        () -> {
          R2Repository repository = repository();
          R2Credentials credentials = repository.store.credentials("public");
          JSONArray files = call.getArray("selectionIds"), jobs = call.getArray("transferIds");
          if (files == null || jobs == null || files.length() + jobs.length() > 500)
            throw new R2Exception("INVALID_SELECTION");
          Set<String> selected = new LinkedHashSet<>(), transfers = new LinkedHashSet<>();
          JSONObject picks = repository.store.snapshot().optJSONObject("selections");
          for (int i = 0; i < files.length(); i++) {
            String id = files.getString(i);
            if (picks == null || !picks.has(id)) throw new R2Exception("SELECTION_NOT_FOUND");
            selected.add(id);
          }
          for (int i = 0; i < jobs.length(); i++) {
            String id = jobs.getString(i);
            JSONObject job = repository.job(id);
            if (!job.optString("slot").equals("public")
                || !job.optString("direction").equals("upload"))
              throw new R2Exception("PUBLICATION_SCOPE_MISMATCH");
            repository.checkCredentialRevision(job);
            transfers.add(id);
          }
          JSONObject queue =
              R2TripQueue.prepare(
                  repository,
                  credentials,
                  call.getString("collection"),
                  selected,
                  transfers,
                  call.getObject("transfersBySelection", new JSObject()));
          JSONObject bindings = queue.getJSONObject("transferIds");
          Iterator<String> keys = bindings.keys();
          while (keys.hasNext()) transfers.add(bindings.getString(keys.next()));
          String token =
              publicationSession.begin(
                  credentials, call.getString("collection"), selected, transfers);
          JSONArray queued = queue.getJSONArray("enqueue");
          R2TransferWorker.enqueueBatch(getContext(), queued);
          call.resolve(
              new JSObject().put("publicationSession", token).put("transferIds", bindings));
        });
  }

  @PluginMethod
  public void endTripPublication(PluginCall call) {
    work(
        call,
        () -> {
          publicationSession.end(call.getString("publicationSession"));
          call.resolve();
        });
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
          R2Credentials credentials = repository().store.credentials(slot);
          if (call.getString("revision") != null
              && !credentials.revision.equals(call.getString("revision")))
            throw new R2Exception("CREDENTIALS_CHANGED");
          JSONObject out =
              new R2Client(credentials)
                  .list(call.getString("prefix", ""), call.getString("cursor", ""))
                  .put("revision", credentials.revision);
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
              && (new R2Catalog(repository().store.credentials(slot)).references(key)
                  || R2Publication.references(
                      repository(), repository().store.credentials(slot), key)))
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
            if (data.getClipData().getItemCount() > 20)
              throw new R2Exception("SELECTION_LIMIT_EXCEEDED");
            for (int i = 0; i < data.getClipData().getItemCount(); i++)
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
            if (R2Policy.recoveryMaterial(name, null))
              throw new R2Exception("RECOVERY_FILE_NOT_MEDIA");
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
    tripAuthorized(
        call,
        () -> {
          publicationSession.selection(
              call.getString("publicationSession"),
              repository().store.credentials("public"),
              call.getString("slot"),
              call.getString("selectionId"));
        },
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
          if (call.getString("publicationSession") != null)
            publicationSession.addTransfer(
                call.getString("publicationSession"),
                credentials,
                call.getString("selectionId"),
                id);
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
          Map<String, List<androidx.work.WorkInfo>> scheduled =
              R2QueueState.index(
                  WorkManager.getInstance(getContext()).getWorkInfosByTag("atlas-r2").get());
          JSONArray stored = repository.jobs(), safe = new JSONArray();
          for (int i = 0; i < stored.length(); i++) {
            JSONObject job = stored.getJSONObject(i), value = repository.safeJob(job);
            JSONObject state =
                R2QueueState.describe(
                    job,
                    scheduled.getOrDefault(job.getString("id"), Collections.emptyList()),
                    System.currentTimeMillis());
            Iterator<String> fields = state.keys();
            while (fields.hasNext()) {
              String key = fields.next();
              value.put(key, state.get(key));
            }
            safe.put(value);
          }
          call.resolve(new JSObject().put("transfers", safe));
        });
  }

  @PluginMethod
  public void recoverTripUploads(PluginCall call) {
    work(
        call,
        () -> {
          synchronized (R2TransferWorker.class) {
            R2Repository repository = repository();
            Map<String, List<androidx.work.WorkInfo>> scheduled =
                R2QueueState.index(
                    WorkManager.getInstance(getContext()).getWorkInfosByTag("atlas-r2").get());
            JSONArray ids = R2QueueState.repair(repository, scheduled);
            R2TransferWorker.enqueueBatch(getContext(), ids);
            call.resolve(new JSObject().put("recovered", ids.length()));
          }
        });
  }

  @PluginMethod
  public void resumeTransfer(PluginCall call) {
    tripAuthorized(
        call,
        () -> {
          publicationSession.transfer(
              call.getString("publicationSession"),
              repository().store.credentials("public"),
              repository().job(call.getString("id")),
              null);
        },
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
          repository()
              .update(
                  id,
                  j -> {
                    if (Set.of("complete", "cancelled", "cancelling")
                        .contains(j.optString("status")))
                      throw new R2Exception("TRANSFER_ALREADY_COMPLETE");
                    j.put("status", "paused");
                  });
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
          repository.update(
              id,
              j -> {
                if (j.optString("status").equals("complete"))
                  throw new R2Exception("TRANSFER_ALREADY_COMPLETE");
                j.put("status", "cancelling");
              });
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
  public void createRecoveryFile(PluginCall call) {
    if (!Boolean.TRUE.equals(call.getBoolean("approved"))) {
      call.reject("RECOVERY_APPROVAL_REQUIRED");
      return;
    }
    authenticated(
        call,
        () -> {
          if (pendingKit != null) throw new R2Exception("SELECTION_BUSY");
          R2Repository repo = repository();
          if (!repo.store.snapshot().has("keyset")) {
            byte[] created = R2Crypto.newKeyset();
            try {
              repo.store.edit(
                  value ->
                      value
                          .put("keyset", Base64.getEncoder().encodeToString(created))
                          .put("recoveryVerified", false));
            } finally {
              Arrays.fill(created, (byte) 0);
            }
          }
          byte[] keys = repo.keyset();
          try {
            pendingKit = R2Crypto.recoveryFile(keys);
          } finally {
            Arrays.fill(keys, (byte) 0);
          }
          getActivity()
              .runOnUiThread(
                  () -> {
                    Intent intent =
                        new Intent(Intent.ACTION_CREATE_DOCUMENT)
                            .addCategory(Intent.CATEGORY_OPENABLE)
                            .setType("application/json");
                    intent.putExtra(Intent.EXTRA_TITLE, "atlas-recovery.atlasr2key");
                    startActivityForResult(call, intent, "recoverySaved");
                  });
        });
  }

  @PluginMethod
  public void restoreRecoveryFile(PluginCall call) {
    authenticated(
        call,
        () -> {
          if (recoveryPassword != null) throw new R2Exception("SELECTION_BUSY");
          recoveryMode = "file";
          recoveryPassword = new char[0];
          getActivity()
              .runOnUiThread(
                  () -> {
                    Intent intent =
                        new Intent(Intent.ACTION_OPEN_DOCUMENT)
                            .addCategory(Intent.CATEGORY_OPENABLE)
                            .setType("*/*");
                    startActivityForResult(call, intent, "recoveryOpened");
                  });
        });
  }

  @PluginMethod
  public void exportAssistantArchive(PluginCall call) {
    authenticated(
        call,
        () -> {
          if (pendingKit != null) throw new R2Exception("SELECTION_BUSY");
          R2Repository repo = repository();
          if (!repo.store.snapshot().optBoolean("recoveryVerified"))
            throw new R2Exception("RECOVERY_REQUIRED");
          JSONObject data =
              new com.lifeatlas.app.security.AtlasDeviceStore(getContext())
                  .read()
                  .optJSONObject("data");
          if (data == null) throw new R2Exception("ASSISTANT_STORAGE_UNAVAILABLE");
          byte[] plain = data.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8),
              keys = repo.keyset();
          try {
            ByteArrayOutputStream encrypted = new ByteArrayOutputStream();
            R2Envelope.encrypt(
                new ByteArrayInputStream(plain),
                encrypted,
                keys,
                "atlas-assistant-archive-v1",
                new JSONObject().put("size", plain.length).put("sha256", R2Policy.digest(plain)));
            pendingKit = encrypted.toByteArray();
          } finally {
            Arrays.fill(plain, (byte) 0);
            Arrays.fill(keys, (byte) 0);
          }
          getActivity()
              .runOnUiThread(
                  () -> {
                    Intent intent =
                        new Intent(Intent.ACTION_CREATE_DOCUMENT)
                            .addCategory(Intent.CATEGORY_OPENABLE)
                            .setType("application/octet-stream");
                    intent.putExtra(Intent.EXTRA_TITLE, "atlas-conversations.atlasai");
                    startActivityForResult(call, intent, "recoverySaved");
                  });
        });
  }

  @PluginMethod
  public void importAssistantArchive(PluginCall call) {
    authenticated(
        call,
        () ->
            getActivity()
                .runOnUiThread(
                    () -> {
                      Intent intent =
                          new Intent(Intent.ACTION_OPEN_DOCUMENT)
                              .addCategory(Intent.CATEGORY_OPENABLE)
                              .setType("*/*");
                      startActivityForResult(call, intent, "assistantArchiveOpened");
                    }));
  }

  @ActivityCallback
  private void assistantArchiveOpened(PluginCall call, ActivityResult result) {
    if (call == null) return;
    work(
        call,
        () -> {
          Uri uri = result.getData() == null ? null : result.getData().getData();
          if (result.getResultCode() != Activity.RESULT_OK || uri == null)
            throw new R2Exception("RECOVERY_IMPORT_CANCELLED");
          byte[] keys = repository().keyset();
          ByteArrayOutputStream plain =
              new ByteArrayOutputStream() {
                public void close() {
                  Arrays.fill(buf, (byte) 0);
                  reset();
                }
              };
          OutputStream limited =
              new OutputStream() {
                public void write(int value) throws IOException {
                  if (plain.size() >= 16 * 1024 * 1024) throw new IOException("ARCHIVE_TOO_LARGE");
                  plain.write(value);
                }

                public void write(byte[] data, int offset, int length) throws IOException {
                  if ((long) plain.size() + length > 16 * 1024 * 1024)
                    throw new IOException("ARCHIVE_TOO_LARGE");
                  plain.write(data, offset, length);
                }
              };
          try (InputStream input = getContext().getContentResolver().openInputStream(uri)) {
            if (input == null) throw new R2Exception("SOURCE_UNAVAILABLE");
            R2Envelope.decrypt(input, limited, keys, "atlas-assistant-archive-v1");
            JSONObject incoming = new JSONObject(plain.toString("UTF-8"));
            if (incoming.optInt("version") != 1
                || incoming.optJSONArray("conversations") == null
                || incoming.optJSONArray("memories") == null)
              throw new R2Exception("INVALID_ASSISTANT_DATA");
            call.resolve(js(new JSONObject().put("data", incoming)));
          } finally {
            Arrays.fill(keys, (byte) 0);
            plain.close();
          }
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
          recoveryMode = "legacy";
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
          String mode = recoveryMode;
          recoveryPassword = null;
          recoveryMode = null;
          try {
            Uri uri = result.getData() == null ? null : result.getData().getData();
            if (result.getResultCode() != Activity.RESULT_OK || uri == null || password == null)
              throw new R2Exception("RECOVERY_IMPORT_CANCELLED");
            byte[] keyset;
            try (InputStream input = getContext().getContentResolver().openInputStream(uri)) {
              if (input == null) throw new R2Exception("SOURCE_UNAVAILABLE");
              keyset =
                  "file".equals(mode)
                      ? R2Crypto.restoreFile(R2Io.read(input, 65536))
                      : R2Crypto.restoreKit(R2Io.read(input, 65536), password);
            }
            try {
              R2Repository repository = repository();
              JSONObject state = repository.store.snapshot();
              if (call.getBoolean("verifyOnly", false) && !state.has("keyset"))
                throw new R2Exception("RECOVERY_REQUIRED");
              if (state.has("keyset") && !MessageDigest.isEqual(keyset, repository.keyset()))
                throw new R2Exception("DIFFERENT_RECOVERY_KEY");
              byte[] synthetic =
                  "Atlas recovery rehearsal".getBytes(java.nio.charset.StandardCharsets.UTF_8);
              ByteArrayOutputStream encrypted = new ByteArrayOutputStream(),
                  restored = new ByteArrayOutputStream();
              R2Envelope.encrypt(
                  new ByteArrayInputStream(synthetic),
                  encrypted,
                  keyset,
                  "recovery-rehearsal",
                  new JSONObject()
                      .put("size", synthetic.length)
                      .put("sha256", R2Policy.digest(synthetic)));
              R2Envelope.decrypt(
                  new ByteArrayInputStream(encrypted.toByteArray()),
                  restored,
                  keyset,
                  "recovery-rehearsal");
              if (!MessageDigest.isEqual(synthetic, restored.toByteArray()))
                throw new R2Exception("INTEGRITY_FAILED");
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
          R2Repository repository = repository();
          call.resolve(
              js(
                  catalog.result(
                      R2Publication.merge(
                          repository, repository.store.credentials("public"), catalog.read()))));
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
  public void publishTripMedia(PluginCall call) {
    tripAuthorized(
        call,
        () -> {
          publicationSession.transfer(
              call.getString("publicationSession"),
              repository().store.credentials("public"),
              repository().job(call.getString("transferId")),
              call.getString("collection"));
        },
        () -> {
          R2Repository repository = repository();
          R2Credentials credentials = repository.store.credentials("public");
          JSONObject prepared =
              new R2Publication(credentials)
                  .publish(repository.job(call.getString("transferId")), call.getData());
          R2Publication.remember(repository, credentials, prepared);
          call.resolve(
              js(
                  new JSONObject()
                      .put("item", prepared.getJSONObject("item"))
                      .put(
                          "manifestUrl", prepared.getJSONObject("item").getString("manifestUrl"))));
        });
  }

  @PluginMethod
  public void unpublishMedia(PluginCall call) {
    authenticated(
        call,
        () -> {
          R2Catalog catalog = new R2Catalog(repository().store.credentials("public"));
          R2Repository repository = repository();
          call.resolve(
              js(
                  catalog.result(
                      R2Publication.unpublish(
                          repository,
                          repository.store.credentials("public"),
                          call.getString("id")))));
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
            JSONArray items =
                R2Publication.merge(repository(), credentials, catalog.read())
                    .getJSONArray("items");
            for (int i = 0; i < items.length(); i++)
              published.add(items.getJSONObject(i).getString("key"));
          }
          for (int i = 0; i < keys.length(); i++) {
            String key = R2Policy.key(keys.getString(i));
            if (key.startsWith("atlas/catalog/")) throw new R2Exception("CATALOG_DELETE_BLOCKED");
            if (published.contains(key)
                || (slot.equals("public")
                    && R2Publication.references(repository(), credentials, key)))
              throw new R2Exception("PUBLISHED_OBJECT");
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

  private volatile String librarySession = "";

  private void libraryGuard(PluginCall call) throws Exception {
    if (!galleryForeground
        || librarySession.isEmpty()
        || !librarySession.equals(call.getString("session")))
      throw new R2Exception("LIBRARY_UNLOCK_REQUIRED");
  }

  @PluginMethod
  public void beginLibrarySession(PluginCall call) {
    authenticated(
        call,
        () -> {
          if (!galleryForeground) throw new R2Exception("LIBRARY_UNLOCK_REQUIRED");
          librarySession = UUID.randomUUID().toString();
          call.resolve(new JSObject().put("session", librarySession));
        });
  }

  @PluginMethod
  public void endLibrarySession(PluginCall call) {
    work(
        call,
        () -> {
          librarySession = "";
          R2LibraryPreviews.clear(getContext());
          R2GalleryPreview.clear(getContext());
          call.resolve();
        });
  }

  @PluginMethod
  public void getLibraryStatus(PluginCall call) {
    work(
        call,
        () -> {
          R2Repository repo = repository();
          JSONObject state = repo.store.snapshot();
          JSONObject result =
              new JSONObject()
                  .put(
                      "autoBackup",
                      state.optJSONObject("autoBackup") == null
                          ? new JSONObject().put("enabled", false)
                          : state.getJSONObject("autoBackup"))
                  .put(
                      "task",
                      state.optJSONObject("libraryTask") == null
                          ? new JSONObject()
                          : state.getJSONObject("libraryTask"));
          JSONArray imports = new JSONArray();
          JSONObject jobs = state.optJSONObject("takeoutJobs");
          if (jobs != null) {
            Iterator<String> ids = jobs.keys();
            while (ids.hasNext()) {
              JSONObject raw = jobs.getJSONObject(ids.next()), safe = new JSONObject();
              for (String key :
                  List.of("id", "name", "status", "error", "files", "bytes", "currentFile"))
                if (raw.has(key)) safe.put(key, raw.get(key));
              imports.put(safe);
            }
          }
          result
              .put("imports", imports)
              .put("androidSdk", Build.VERSION.SDK_INT)
              .put("trashDays", state.optInt("libraryTrashDays", 30));
          if (new java.io.File(repo.store.directory(), "library.db").exists())
            try (R2LibraryStore library = new R2LibraryStore(repo)) {
              result.put("importSummary", library.importSummary());
            }
          JSONArray transfers = repo.jobs();
          int active = 0, failed = 0;
          for (int i = 0; i < transfers.length(); i++) {
            JSONObject j = transfers.getJSONObject(i);
            if (!j.optBoolean("autoBackup")) continue;
            if (Set.of("failed", "interrupted").contains(j.optString("status"))) failed++;
            else if (!Set.of("cancelled", "complete", "paused").contains(j.optString("status")))
              active++;
          }
          result.put(
              "backupTransfers", new JSONObject().put("active", active).put("failed", failed));
          call.resolve(js(result));
        });
  }

  @PluginMethod
  public void getBackupAlbums(PluginCall call) {
    work(
        call,
        () -> {
          Map<String, JSONObject> albums = new TreeMap<>();
          String cursor = "";
          do {
            JSONObject page =
                new R2DeviceGallery(getContext()).list(cursor, "", "all", "", "newest");
            JSONArray rows = page.getJSONArray("items");
            for (int i = 0; i < rows.length(); i++) {
              JSONObject media = rows.getJSONObject(i);
              String id = media.optString("albumId");
              if (id.isEmpty()) continue;
              JSONObject album = albums.get(id);
              if (album == null) {
                album =
                    new JSONObject()
                        .put("id", id)
                        .put("name", media.optString("album", "Unnamed album"))
                        .put("count", 0);
                albums.put(id, album);
              }
              album.put("count", album.getInt("count") + 1);
            }
            if (page.getBoolean("complete")) break;
            cursor = page.getString("cursor");
          } while (true);
          call.resolve(new JSObject().put("albums", new JSONArray(albums.values())));
        });
  }

  @PluginMethod
  public void configureAutoBackup(PluginCall call) {
    try {
      guard();
    } catch (Exception e) {
      fail(call, e);
      return;
    }
    JSObject settings = call.getObject("settings");
    if (settings != null
        && settings.optBoolean("enabled")
        && Build.VERSION.SDK_INT >= 29
        && getPermissionState("galleryOriginal") != PermissionState.GRANTED) {
      requestPermissionForAlias("galleryOriginal", call, "backupOriginalPermission");
      return;
    }
    authenticated(
        call,
        () ->
            call.resolve(
                js(
                    R2AutoBackup.configure(
                        getContext(), repository(), call.getObject("settings")))));
  }

  @PermissionCallback
  private void backupOriginalPermission(PluginCall call) {
    if (getPermissionState("galleryOriginal") != PermissionState.GRANTED) {
      call.reject("ORIGINAL_MEDIA_ACCESS_REQUIRED", "ORIGINAL_MEDIA_ACCESS_REQUIRED");
      return;
    }
    configureAutoBackup(call);
  }

  @PluginMethod
  public void scanBackupNow(PluginCall call) {
    work(
        call,
        () -> {
          R2Repository repo = repository();
          JSONObject config = repo.store.snapshot().optJSONObject("autoBackup");
          R2AutoBackup.valid(getContext(), repo, config);
          R2AutoBackup.scan(getContext(), config);
          call.resolve();
        });
  }

  @PluginMethod
  public void listLibrary(PluginCall call) {
    work(
        call,
        () -> {
          libraryGuard(call);
          R2Repository repo = repository();
          String slot = R2Policy.slot(call.getString("slot", "private")),
              state = call.getString("state", "active");
          if (!Set.of("active", "trashed", "deleted", "conflict").contains(state))
            throw new R2Exception("INVALID_SELECTION");
          int offset = Math.max(0, call.getInt("offset", 0));
          try (R2LibraryStore index = new R2LibraryStore(repo)) {
            String scope = R2Duplicates.scope(repo.store.credentials(slot));
            JSONArray rows = index.page(scope, state, offset, 51), safe = new JSONArray();
            for (int i = 0; i < Math.min(50, rows.length()); i++)
              safe.put(R2Library.safe(rows.getJSONObject(i)));
            call.resolve(
                new JSObject()
                    .put("items", safe)
                    .put("offset", offset + safe.length())
                    .put("complete", rows.length() <= 50)
                    .put("counts", index.counts(scope)));
          }
        });
  }

  @PluginMethod
  public void libraryThumbnail(PluginCall call) {
    work(
        call,
        () -> {
          libraryGuard(call);
          R2Repository repo = repository();
          try (R2LibraryStore store = new R2LibraryStore(repo)) {
            JSONObject record = store.get(call.getString("id"));
            R2Library.checkScope(repo, record);
            if (!Set.of("active", "trashed").contains(record.optString("state")))
              throw new R2Exception("LIBRARY_ITEM_IN_TRASH");
            java.io.File cached =
                new java.io.File(
                    R2LibraryPreviews.cache(getContext()), record.getString("id") + ".jpg");
            JSONObject result =
                cached.exists()
                    ? new JSONObject().put("path", cached.getAbsolutePath())
                    : R2LibraryPreviews.open(getContext(), repo, record, "thumbnail");
            try {
              libraryGuard(call);
            } catch (Exception error) {
              R2LibraryPreviews.clear(getContext());
              throw error;
            }
            call.resolve(js(result));
          }
        });
  }

  @PluginMethod
  public void libraryPreview(PluginCall call) {
    work(
        call,
        () -> {
          libraryGuard(call);
          R2Repository repo = repository();
          try (R2LibraryStore store = new R2LibraryStore(repo)) {
            JSONObject r = store.get(call.getString("id"));
            String variant = call.getString("variant", "original");
            if (!Set.of("original", "clip").contains(variant))
              throw new R2Exception("INVALID_SELECTION");
            JSONObject preview = R2LibraryPreviews.open(getContext(), repo, r, variant);
            try {
              libraryGuard(call);
            } catch (Exception error) {
              if (preview.has("token"))
                R2GalleryPreview.release(getContext(), preview.getString("token"));
              throw error;
            }
            call.resolve(js(preview));
          }
        });
  }

  @PluginMethod
  public void downloadLibraryOriginal(PluginCall call) {
    work(
        call,
        () -> {
          libraryGuard(call);
          R2Repository repo = repository();
          try (R2LibraryStore store = new R2LibraryStore(repo)) {
            JSONObject r = store.get(call.getString("id"));
            R2Library.checkScope(repo, r);
            call.getData()
                .put("slot", r.getString("slot"))
                .put("key", r.getString("key"))
                .put("name", r.getString("name"));
            downloadObject(call);
          }
        });
  }

  @PluginMethod
  public void getDeviceTrash(PluginCall call) {
    work(
        call,
        () -> {
          if (Build.VERSION.SDK_INT < 30) throw new R2Exception("ANDROID_11_REQUIRED");
          String cursor = call.getString("cursor", "0:external");
          String[] parts = cursor.split(":", 2);
          if (parts.length != 2
              || !parts[0].matches("[0-9]+")
              || !parts[1].matches("[a-zA-Z0-9_-]+")) throw new R2Exception("INVALID_SELECTION");
          android.os.Bundle args = new android.os.Bundle();
          args.putInt(MediaStore.QUERY_ARG_MATCH_TRASHED, MediaStore.MATCH_ONLY);
          args.putString(
              ContentResolver.QUERY_ARG_SQL_SELECTION,
              "media_type IN(1,3) AND (_id>? OR (_id=? AND volume_name>?))");
          args.putStringArray(
              ContentResolver.QUERY_ARG_SQL_SELECTION_ARGS,
              new String[] {parts[0], parts[0], parts[1]});
          args.putString(ContentResolver.QUERY_ARG_SQL_SORT_ORDER, "_id ASC,volume_name ASC");
          args.putInt(ContentResolver.QUERY_ARG_LIMIT, 81);
          JSONArray rows = new JSONArray();
          boolean more = false;
          String next = cursor;
          try (Cursor c =
              getContext()
                  .getContentResolver()
                  .query(
                      MediaStore.Files.getContentUri("external"),
                      new String[] {
                        "_id", "_display_name", "mime_type", "_size", "volume_name", "date_expires"
                      },
                      args,
                      null)) {
            while (c != null && c.moveToNext()) {
              if (rows.length() == 80) {
                more = true;
                break;
              }
              String mime = c.getString(2), volume = c.getString(4);
              rows.put(
                  new JSONObject()
                      .put(
                          "id",
                          (mime.startsWith("video/") ? "video:" : "image:")
                              + volume
                              + ":"
                              + c.getLong(0))
                      .put("name", c.getString(1))
                      .put("mimeType", mime)
                      .put("size", c.getLong(3))
                      .put("expiresAt", c.getLong(5) * 1000));
              next = c.getLong(0) + ":" + volume;
            }
          }
          call.resolve(
              new JSObject().put("items", rows).put("cursor", next).put("complete", !more));
        });
  }

  @PluginMethod
  public void saveLibraryPreferences(PluginCall call) {
    work(
        call,
        () -> {
          int days = call.getInt("trashDays", 30);
          if (!Set.of(7, 30, 60, 90).contains(days)) throw new R2Exception("INVALID_SELECTION");
          repository().store.edit(state -> state.put("libraryTrashDays", days));
          call.resolve();
        });
  }

  @PluginMethod
  public void changeLibraryTrash(PluginCall call) {
    authenticated(
        call,
        () -> {
          R2Repository repo = repository();
          String action = call.getString("action");
          JSONArray ids = call.getArray("ids");
          if (ids == null || ids.length() == 0 || ids.length() > 100)
            throw new R2Exception("INVALID_SELECTION");
          for (int i = 0; i < ids.length(); i++) {
            if (action.equals("trash"))
              R2Library.trash(repo, ids.getString(i), call.getInt("days", 30));
            else if (action.equals("restore")) R2Library.restoreTrash(repo, ids.getString(i));
            else if (action.equals("purge")) R2Library.purge(repo, ids.getString(i));
            else throw new R2Exception("INVALID_SELECTION");
          }
          librarySession = java.util.UUID.randomUUID().toString();
          call.resolve(new JSObject().put("session", librarySession));
        });
  }

  @PluginMethod
  public void startLibraryTask(PluginCall call) {
    authenticated(
        call,
        () -> {
          String action = call.getString("action");
          if (!Set.of("restore", "sync", "reconcile").contains(action))
            throw new R2Exception("INVALID_SELECTION");
          repository().keyset();
          R2LibraryWorker.enqueue(getContext(), action);
          call.resolve();
        });
  }

  @PluginMethod
  public void trashDeviceMedia(PluginCall call) {
    authenticated(
        call,
        () -> {
          if (Build.VERSION.SDK_INT < 30) throw new R2Exception("ANDROID_11_REQUIRED");
          JSONArray ids = call.getArray("ids");
          if (ids == null || ids.length() == 0 || ids.length() > 100)
            throw new R2Exception("INVALID_SELECTION");
          List<Uri> uris = new ArrayList<>();
          for (int i = 0; i < ids.length(); i++) uris.add(R2DeviceGallery.uri(ids.getString(i)));
          PendingIntent intent =
              MediaStore.createTrashRequest(
                  getContext().getContentResolver(), uris, call.getBoolean("trashed", true));
          Intent launch =
              new androidx.activity.result.contract.ActivityResultContracts
                      .StartIntentSenderForResult()
                  .createIntent(
                      getContext(),
                      new androidx.activity.result.IntentSenderRequest.Builder(intent).build());
          startActivityForResult(call, launch, "phoneTrashResult");
        });
  }

  @ActivityCallback
  private void phoneTrashResult(PluginCall call, ActivityResult result) {
    if (call != null)
      call.resolve(new JSObject().put("approved", result.getResultCode() == Activity.RESULT_OK));
  }

  @PluginMethod
  public void pickTakeoutArchives(PluginCall call) {
    work(
        call,
        () -> {
          Intent intent =
              new Intent(Intent.ACTION_OPEN_DOCUMENT)
                  .setType("application/zip")
                  .addCategory(Intent.CATEGORY_OPENABLE)
                  .putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
                  .addFlags(
                      Intent.FLAG_GRANT_READ_URI_PERMISSION
                          | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
          startActivityForResult(call, intent, "takeoutPicked");
        });
  }

  @ActivityCallback
  private void takeoutPicked(PluginCall call, ActivityResult result) {
    if (call == null) return;
    if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
      call.resolve(new JSObject().put("files", new JSONArray()));
      return;
    }
    work(
        call,
        () -> {
          Intent data = result.getData();
          List<Uri> uris = new ArrayList<>();
          if (data.getClipData() != null)
            for (int i = 0; i < data.getClipData().getItemCount(); i++)
              uris.add(data.getClipData().getItemAt(i).getUri());
          else if (data.getData() != null) uris.add(data.getData());
          if (uris.size() > 10) throw new R2Exception("INVALID_SELECTION");
          JSONArray out = new JSONArray();
          for (Uri uri : uris) {
            getContext()
                .getContentResolver()
                .takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
            String id = UUID.randomUUID().toString(), name = "Takeout archive";
            try (Cursor c =
                getContext()
                    .getContentResolver()
                    .query(uri, new String[] {OpenableColumns.DISPLAY_NAME}, null, null, null)) {
              if (c != null && c.moveToFirst()) name = c.getString(0);
            }
            JSONObject job =
                new JSONObject()
                    .put("id", id)
                    .put("uri", uri.toString())
                    .put("name", name)
                    .put("status", "selected")
                    .put("files", 0);
            repository()
                .store
                .edit(
                    state -> {
                      JSONObject jobs = state.optJSONObject("takeoutJobs");
                      if (jobs == null) {
                        jobs = new JSONObject();
                        state.put("takeoutJobs", jobs);
                      }
                      jobs.put(id, job);
                    });
            out.put(new JSONObject().put("id", id).put("name", name));
          }
          call.resolve(new JSObject().put("files", out));
        });
  }

  @PluginMethod
  public void controlTakeoutImport(PluginCall call) {
    work(
        call,
        () -> {
          String id = call.getString("id"), action = call.getString("action");
          JSONObject job =
              repository().store.snapshot().getJSONObject("takeoutJobs").getJSONObject(id);
          if (action.equals("pause")) {
            repository()
                .store
                .edit(
                    state ->
                        state
                            .getJSONObject("takeoutJobs")
                            .getJSONObject(id)
                            .put("status", "paused"));
          } else if (action.equals("start")) {
            repository()
                .store
                .edit(
                    state ->
                        state
                            .getJSONObject("takeoutJobs")
                            .getJSONObject(id)
                            .put("status", "queued"));
            R2TakeoutWorker.enqueue(getContext(), id);
          } else throw new R2Exception("INVALID_SELECTION");
          call.resolve();
        });
  }

  private android.database.ContentObserver galleryObserver;
  private final android.os.Handler galleryHandler =
      new android.os.Handler(android.os.Looper.getMainLooper());
  private final Runnable galleryChanged =
      () ->
          execute(
              () -> {
                try {
                  if (new GalleryIntelligence(getContext()).refreshMediaIfChanged())
                    notifyListeners("galleryChanged", new JSObject());
                } catch (Exception ignored) {
                }
              });

  @Override
  public void load() {
    if (Build.VERSION.SDK_INT < 26) return;
    galleryObserver =
        new android.database.ContentObserver(galleryHandler) {
          @Override
          public void onChange(boolean self, Uri uri) {
            galleryHandler.removeCallbacks(galleryChanged);
            galleryHandler.postDelayed(galleryChanged, 1500);
          }
        };
    try {
      getContext()
          .getContentResolver()
          .registerContentObserver(
              MediaStore.Images.Media.EXTERNAL_CONTENT_URI, true, galleryObserver);
      getContext()
          .getContentResolver()
          .registerContentObserver(
              MediaStore.Video.Media.EXTERNAL_CONTENT_URI, true, galleryObserver);
    } catch (SecurityException ignored) {
    }
  }

  private volatile boolean galleryForeground = true;

  @Override
  protected void handleOnPause() {
    gallerySearchGeneration.incrementAndGet();
    GallerySearchInference.releaseWarm();
    GallerySearchHotCache.suspend();
    gallerySearchGeneration.incrementAndGet();
    galleryForeground = false;
    librarySession = "";
    R2LibraryPreviews.clear(getContext());
    R2GalleryPreview.clear(getContext());
    super.handleOnPause();
  }

  @Override
  protected void handleOnResume() {
    galleryForeground = true;
    GallerySearchHotCache.resume();
    galleryHandler.removeCallbacks(galleryChanged);
    galleryHandler.postDelayed(galleryChanged, 1500);
    super.handleOnResume();
  }

  @Override
  protected void handleOnDestroy() {
    GallerySearchInference.releaseWarm();
    GallerySearchHotCache.suspend();
    galleryHandler.removeCallbacks(galleryChanged);
    if (galleryObserver != null)
      getContext().getContentResolver().unregisterContentObserver(galleryObserver);
    if (recoveryPassword != null) Arrays.fill(recoveryPassword, '\0');
    if (pendingKit != null) Arrays.fill(pendingKit, (byte) 0);
    R2GalleryPreview.clear(getContext());
    librarySession = "";
    R2LibraryPreviews.clear(getContext());
    selections.clear();
    publicationSession.clear();
    super.handleOnDestroy();
  }
}
