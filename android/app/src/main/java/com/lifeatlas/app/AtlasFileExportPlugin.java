package com.lifeatlas.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.OutputStream;

/** Save local backups, documents and playlists through Android's document picker, including offline. */
@CapacitorPlugin(name = "AtlasFileExport")
public class AtlasFileExportPlugin extends Plugin {
    @PluginMethod
    public void saveFile(PluginCall call) {
        if (call.getString("data") == null) { call.reject("No file data provided"); return; }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(call.getString("mimeType", "application/octet-stream"));
        intent.putExtra(Intent.EXTRA_TITLE, call.getString("name", "atlas-export"));
        try { startActivityForResult(call, intent, "fileChosen"); }
        catch (Exception error) { call.reject("No document app is available to save this file", error); }
    }

    @ActivityCallback
    private void fileChosen(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Uri uri = result.getData() == null ? null : result.getData().getData();
        if (result.getResultCode() != Activity.RESULT_OK || uri == null) {
            call.resolve(new JSObject().put("saved", false));
            return;
        }
        execute(() -> {
            try (OutputStream output = getContext().getContentResolver().openOutputStream(uri)) {
                if (output == null) throw new IllegalStateException("The selected document cannot be written");
                output.write(Base64.decode(call.getString("data", ""), Base64.DEFAULT));
                call.resolve(new JSObject().put("saved", true));
            } catch (Exception error) { call.reject("Could not save the exported file", error); }
        });
    }
}
