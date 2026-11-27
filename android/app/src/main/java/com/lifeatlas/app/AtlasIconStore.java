package com.lifeatlas.app;

import android.content.Context;
import android.content.Intent;
import android.content.pm.ShortcutInfo;
import android.content.pm.ShortcutManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.Icon;
import android.os.Build;
import android.util.AtomicFile;
import android.util.Base64;
import com.getcapacitor.JSObject;
import java.io.File;
import java.io.FileOutputStream;
import java.io.FileInputStream;
import java.io.ByteArrayOutputStream;
import java.util.Collections;

/** Small, local-only shortcut artwork. Never stores the chosen original photo or its EXIF. */
public final class AtlasIconStore {
    private final Context context;
    public AtlasIconStore(Context context) { this.context = context.getApplicationContext(); }
    private void requireModule(String module) {
        if (!AtlasIconPolicy.valid(module)) throw new IllegalArgumentException("Choose an Atlas app");
    }
    private File file(String module) {
        requireModule(module);
        File directory = new File(context.getNoBackupFilesDir(), "atlas-icons");
        if (!directory.isDirectory() && !directory.mkdirs()) throw new IllegalStateException("Icon storage is unavailable");
        return new File(directory, module + ".png");
    }
    private android.content.SharedPreferences preferences() { return context.getSharedPreferences("atlas-icons", Context.MODE_PRIVATE); }
    private String label(String module) { return preferences().getString(module, AtlasIconPolicy.label(module)); }
    private boolean installed(String module) {
        return !"video".equals(module) || context.getPackageManager().getLaunchIntentForPackage("com.lifeatlas.video") != null;
    }
    public JSObject summary(String module, boolean includeImage) throws Exception {
        synchronized (AtlasIconStore.class) {
            requireModule(module);
            File file = file(module);
            boolean custom = file.isFile() || new File(file.getPath() + ".bak").isFile();
            JSObject result = new JSObject().put("module", module).put("label", label(module))
                .put("custom", custom).put("installed", installed(module))
                .put("supported", supported());
            String design = preferences().getString(module + ".design", null);
            if (design != null) result.put("design", new JSObject(design));
            if (includeImage && custom) {
                if (file.length() > 1_500_000) throw new IllegalStateException("Saved icon is too large");
                byte[] bytes;
                try (FileInputStream input = new AtomicFile(file).openRead(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                    byte[] buffer = new byte[8192]; int read;
                    while ((read = input.read(buffer)) != -1) {
                        if (output.size() + read > 1_500_000) throw new IllegalStateException("Saved icon is too large");
                        output.write(buffer, 0, read);
                    }
                    bytes = output.toByteArray();
                }
                if (bytes.length <= 1_500_000) result.put("pngBase64", Base64.encodeToString(bytes, Base64.NO_WRAP));
            }
            return result;
        }
    }
    public boolean supported() {
        if (Build.VERSION.SDK_INT < 26) return false;
        ShortcutManager manager = context.getSystemService(ShortcutManager.class);
        return manager != null && manager.isRequestPinShortcutSupported();
    }
    private Icon defaultIcon(String module) throws Exception {
        switch (module) {
            case "gallery": return Icon.createWithResource(context, R.drawable.ic_atlas_photos);
            case "music": return Icon.createWithResource(context, R.drawable.ic_atlas_music);
            case "finance": return Icon.createWithResource(context, R.drawable.ic_atlas_finance);
            case "video": {
                Drawable drawable = context.getPackageManager().getApplicationIcon("com.lifeatlas.video");
                Bitmap bitmap = Bitmap.createBitmap(192, 192, Bitmap.Config.ARGB_8888);
                drawable.setBounds(0, 0, 192, 192); drawable.draw(new Canvas(bitmap));
                return Icon.createWithBitmap(bitmap);
            }
            default: return Icon.createWithResource(context, R.mipmap.ic_launcher);
        }
    }
    private ShortcutInfo shortcut(String module) throws Exception {
        Intent intent;
        if ("video".equals(module)) {
            intent = context.getPackageManager().getLaunchIntentForPackage("com.lifeatlas.video");
            if (intent == null) throw new IllegalArgumentException("Install Atlas Video first from Atlas Apps");
        } else {
            intent = new Intent(context, MainActivity.class).setAction("com.lifeatlas.app.OPEN_MODULE")
                .putExtra("atlas_module", module).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        }
        File image = file(module);
        Bitmap bitmap = null;
        if (image.isFile() || new File(image.getPath() + ".bak").isFile()) {
            try (FileInputStream input = new AtomicFile(image).openRead()) { bitmap = BitmapFactory.decodeStream(input); }
        }
        Icon icon = bitmap == null ? defaultIcon(module) : Icon.createWithBitmap(bitmap);
        return new ShortcutInfo.Builder(context, "atlas-" + module).setShortLabel(label(module))
            .setLongLabel(label(module)).setIcon(icon).setIntent(intent).build();
    }
    private boolean updatePinned(String module) throws Exception {
        if (Build.VERSION.SDK_INT < 26 || !installed(module)) return false;
        ShortcutManager manager = context.getSystemService(ShortcutManager.class);
        if (manager == null) return false;
        for (ShortcutInfo pinned : manager.getPinnedShortcuts()) {
            if (("atlas-" + module).equals(pinned.getId())) return manager.updateShortcuts(Collections.singletonList(shortcut(module)));
        }
        return false;
    }
    public JSObject save(String module, String name, String encoded, JSObject design) throws Exception {
        synchronized (AtlasIconStore.class) {
            requireModule(module);
            String label = AtlasIconPolicy.safeLabel(name, module);
            if (design == null) throw new IllegalArgumentException("Choose an icon design");
            String style = design.getString("style"), shape = design.getString("shape"), color = design.getString("color"), source = design.getString("source");
            AtlasIconPolicy.validateDesign(style, shape, color, source);
            JSObject safeDesign = new JSObject().put("style", style).put("shape", shape).put("color", color).put("source", source);
            if (encoded == null || encoded.length() > 2_000_000) throw new IllegalArgumentException("Choose a smaller icon image");
            byte[] bytes = Base64.decode(encoded, Base64.DEFAULT);
            AtlasIconPolicy.validatePng(bytes);
            BitmapFactory.Options bounds = new BitmapFactory.Options(); bounds.inJustDecodeBounds = true;
            BitmapFactory.decodeByteArray(bytes, 0, bytes.length, bounds);
            if (bounds.outWidth != 512 || bounds.outHeight != 512) throw new IllegalArgumentException("Icon must be 512 by 512 pixels");
            Bitmap bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
            if (bitmap == null) throw new IllegalArgumentException("The image could not be opened");
            AtomicFile destination = new AtomicFile(file(module));
            FileOutputStream output = null;
            try {
                output = destination.startWrite();
                if (!bitmap.compress(Bitmap.CompressFormat.PNG, 100, output)) throw new IllegalStateException("Icon could not be saved");
                destination.finishWrite(output);
            } catch (Exception error) { if (output != null) destination.failWrite(output); throw error; }
            finally { bitmap.recycle(); }
            if (!preferences().edit().putString(module, label).putString(module + ".design", safeDesign.toString()).commit()) throw new IllegalStateException("Icon name could not be saved");
            boolean updated = false;
            try { updated = updatePinned(module); } catch (Exception ignored) { /* Saved artwork remains available for pinning. */ }
            return summary(module, false).put("updated", updated);
        }
    }
    public JSObject pin(String module) throws Exception {
        synchronized (AtlasIconStore.class) {
            requireModule(module);
            if (!supported()) return new JSObject().put("supported", false).put("requested", false);
            boolean updated = updatePinned(module);
            boolean requested = !updated && context.getSystemService(ShortcutManager.class).requestPinShortcut(shortcut(module), null);
            return new JSObject().put("supported", true).put("requested", requested).put("updated", updated);
        }
    }
    public JSObject reset(String module) throws Exception {
        synchronized (AtlasIconStore.class) {
            requireModule(module);
            new AtomicFile(file(module)).delete();
            if (!preferences().edit().remove(module).remove(module + ".design").commit()) throw new IllegalStateException("Icon name could not be reset");
            boolean updated = false;
            try { updated = updatePinned(module); } catch (Exception ignored) { }
            return summary(module, false).put("updated", updated);
        }
    }
}
