package com.lifeatlas.app;

import android.app.Activity;
import android.content.Intent;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;
import com.lifeatlas.app.ai.*;
import java.util.concurrent.*;
import org.json.*;

/** Narrow native model management: catalogue IDs or a system-picked URI, never a JS URL. */
@CapacitorPlugin(name = "AtlasModels")
public class AtlasModelsPlugin extends Plugin {
  private final ExecutorService worker = Executors.newSingleThreadExecutor();

  private AtlasModelStore store() {
    return AtlasModelStore.get(getContext());
  }

  private JSObject json(JSONObject value) {
    try {
      return JSObject.fromJSONObject(value);
    } catch (JSONException e) {
      return new JSObject();
    }
  }

  @PluginMethod
  public void list(PluginCall call) {
    worker.execute(
        () -> {
          try {
            call.resolve(
                new JSObject()
                    .put("models", store().list())
                    .put("transfers", store().transferList())
                    .put("selected", store().selected())
                    .put("availableBytes", getContext().getNoBackupFilesDir().getUsableSpace()));
          } catch (Exception e) {
            call.reject("Could not read model library");
          }
        });
  }

  @PluginMethod
  public void install(PluginCall call) {
    if (!Boolean.TRUE.equals(call.getBoolean("consent", false))) {
      call.reject("Download and license confirmation required");
      return;
    }
    try {
      androidx.core.content.ContextCompat.startForegroundService(
          getContext(), new Intent(getContext(), AtlasModelDownloadService.class));
    } catch (Exception e) {
      call.reject("Open Atlas before starting a model download");
      return;
    }
    // The process-owned job must not retain a destroyed Activity/PluginCall for a long download.
    store()
        .download(
            call.getString("id", ""), true, Boolean.TRUE.equals(call.getBoolean("wifiOnly", true)));
    call.resolve(new JSObject().put("queued", true));
  }

  @PluginMethod
  public void progress(PluginCall call) {
    call.resolve(json(store().transfer(call.getString("id", ""))));
  }

  @PluginMethod
  public void pause(PluginCall call) {
    store().pause(call.getString("id", ""));
    call.resolve();
  }

  @PluginMethod
  public void cancel(PluginCall call) {
    try {
      store().cancel(call.getString("id", ""));
      call.resolve();
    } catch (Exception e) {
      call.reject("Could not cancel transfer");
    }
  }

  @PluginMethod
  public void select(PluginCall call) {
    worker.execute(
        () -> {
          try {
            String id = call.getString("id", "");
            AtlasInferenceRuntime.get(getContext()).selectModel(id).get();
            call.resolve();
          } catch (Exception e) {
            call.reject("Select a complete, checksum-verified model");
          }
        });
  }

  @PluginMethod
  public void remove(PluginCall call) {
    if (!Boolean.TRUE.equals(call.getBoolean("confirm", false))) {
      call.reject("Confirm removal first");
      return;
    }
    worker.execute(
        () -> {
          try {
            String id = call.getString("id", "");
            AtlasInferenceRuntime.get(getContext()).removeModel(id).get();
            call.resolve();
          } catch (Exception e) {
            call.reject("Pause the download or inference before removing the model");
          }
        });
  }

  @PluginMethod
  public void importModel(PluginCall call) {
    if (!Boolean.TRUE.equals(call.getBoolean("consent", false))) {
      call.reject("Confirm you trust the GGUF source and accept its license");
      return;
    }
    Intent picker = new Intent(Intent.ACTION_OPEN_DOCUMENT);
    picker.addCategory(Intent.CATEGORY_OPENABLE);
    picker.setType("*/*");
    startActivityForResult(call, picker, "modelPicked");
  }

  @ActivityCallback
  private void modelPicked(PluginCall call, ActivityResult result) {
    if (call == null) return;
    if (result.getResultCode() != Activity.RESULT_OK
        || result.getData() == null
        || result.getData().getData() == null) {
      call.reject("Import canceled");
      return;
    }
    android.net.Uri uri = result.getData().getData();
    String name = "Imported GGUF";
    try (android.database.Cursor cursor =
        getContext()
            .getContentResolver()
            .query(
                uri,
                new String[] {android.provider.OpenableColumns.DISPLAY_NAME},
                null,
                null,
                null)) {
      if (cursor != null && cursor.moveToFirst()) name = cursor.getString(0);
    } catch (Exception ignored) {
    }
    try {
      androidx.core.content.ContextCompat.startForegroundService(
          getContext(), new Intent(getContext(), AtlasModelDownloadService.class));
    } catch (Exception e) {
      call.reject("Return to Atlas to import a model");
      return;
    }
    if (name == null || name.trim().isEmpty()) name = "Imported GGUF";
    String transfer =
        store().startImport(uri, name.substring(0, Math.min(120, name.length())), true);
    call.resolve(new JSObject().put("transferId", transfer));
  }

  @PluginMethod
  public void saveBenchmark(PluginCall call) {
    worker.execute(
        () -> {
          try {
            new AtlasLabHistory(getContext()).save(call.getObject("report"));
            call.resolve();
          } catch (Exception e) {
            call.reject("Could not save benchmark history. Export the report instead.");
          }
        });
  }

  @PluginMethod
  public void listBenchmarks(PluginCall call) {
    worker.execute(
        () -> {
          try {
            call.resolve(new JSObject().put("reports", new AtlasLabHistory(getContext()).list()));
          } catch (Exception e) {
            call.reject("Could not read benchmark history");
          }
        });
  }

  @PluginMethod
  public void clearBenchmarks(PluginCall call) {
    if (!Boolean.TRUE.equals(call.getBoolean("confirm", false))) {
      call.reject("Confirm first");
      return;
    }
    worker.execute(
        () -> {
          new AtlasLabHistory(getContext()).clear();
          call.resolve();
        });
  }

  @Override
  protected void handleOnDestroy() {
    worker.shutdown();
  }
}
