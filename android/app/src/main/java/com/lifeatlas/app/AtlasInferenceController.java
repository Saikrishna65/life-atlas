package com.lifeatlas.app;

import android.app.ActivityManager;
import android.content.Context;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;

/** Single-flight foreground inference. All native handles are owned by this controller. */
final class AtlasInferenceController {
    private final Context context;
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private boolean closed;
    private Request active;

    private static final class Request {
        final String id;
        final long handle;
        final AtomicBoolean canceled = new AtomicBoolean();
        Request(String id, long handle) { this.id = id; this.handle = handle; }
    }
    AtlasInferenceController(Context context) { this.context = context.getApplicationContext(); }

    JSObject status() {
        if (!AtlasLlamaNative.available()) return status(false, "none", "This build has no native inference library.");
        try {
            AtlasVerifiedModel model = AtlasVerifiedModel.selected(context);
            requireMemory(model);
            return status(true, "llama.cpp", "Selected model file is present. Integrity is checked before each generation.");
        } catch (Exception e) {
            return status(false, "llama.cpp", "A reviewed installed model and sufficient available memory are required.");
        }
    }

    private static JSObject status(boolean available, String engine, String reason) {
        return new JSObject().put("available", available).put("engine", engine).put("reason", reason);
    }

    private void requireMemory(AtlasVerifiedModel model) {
        ActivityManager manager = (ActivityManager) context.getSystemService(Context.ACTIVITY_SERVICE);
        if (manager == null) throw new IllegalStateException("Memory status unavailable");
        ActivityManager.MemoryInfo memory = new ActivityManager.MemoryInfo();
        manager.getMemoryInfo(memory);
        // Conservative preliminary guard, not a substitute for device profiling.
        if (memory.lowMemory || memory.availMem < model.size + Math.max(memory.threshold, 536870912L))
            throw new IllegalStateException("Insufficient available memory for local inference");
    }

    synchronized void start(PluginCall call, Consumer<String> token) {
        String id = call.getString("requestId", "");
        String prompt = call.getString("prompt", "");
        Integer max = call.getInt("maxTokens", 256);
        if (id == null || !id.matches("[A-Za-z0-9-]{1,80}") || prompt == null
                || prompt.trim().isEmpty() || prompt.length() > 24000 || max == null || max < 1 || max > 512) {
            call.reject("Invalid local inference request"); return;
        }
        if (closed || !AtlasLlamaNative.available()) {
            call.reject("Local inference runtime unavailable"); return;
        }
        if (active != null) { call.reject("Another local generation is active"); return; }
        final Request request;
        try {
            long handle = AtlasLlamaNative.create();
            if (handle == 0) throw new IllegalStateException("Native request allocation failed");
            request = new Request(id, handle);
        } catch (RuntimeException | LinkageError e) {
            call.reject("Could not initialize local inference"); return;
        }
        active = request;
        worker.execute(() -> run(request, prompt, max, token, call));
    }

    private void run(Request r, String prompt, int max, Consumer<String> token, PluginCall call) {
        String failure = null;
        try {
            AtlasVerifiedModel model = AtlasVerifiedModel.selected(context);
            requireMemory(model);
            model.verify(r.canceled);
            requireMemory(model);
            // Refuse a changed selection, rather than silently running the old model.
            AtlasVerifiedModel selected = AtlasVerifiedModel.selected(context);
            if (!selected.digest.equals(model.digest)) throw new IllegalStateException("Model selection changed");
            if (r.canceled.get()) throw new IllegalStateException("Generation canceled");
            AtlasLlamaNative.Utf8Stream decoder = new AtlasLlamaNative.Utf8Stream(value -> {
                if (!r.canceled.get()) token.accept(value);
            });
            AtlasLlamaNative.generate(r.handle, model.file.getPath().getBytes(StandardCharsets.UTF_8),
                    prompt.getBytes(StandardCharsets.UTF_8), max, bytes -> {
                if (r.canceled.get()) return false;
                decoder.accept(bytes);
                return !r.canceled.get();
            });
            if (!r.canceled.get()) decoder.finish();
        } catch (Exception | LinkageError e) {
            failure = "Local generation failed. Verify model integrity, context size and available memory.";
        } catch (OutOfMemoryError e) {
            failure = "Insufficient memory for local generation.";
        } finally {
            synchronized (this) {
                if (r.canceled.get()) failure = "Generation canceled";
                AtlasLlamaNative.release(r.handle);
                active = null;
            }
        }
        if (failure == null) call.resolve();
        else call.reject(failure);
    }

    synchronized void cancel(String id) {
        if (active != null && (id == null || active.id.equals(id))) {
            active.canceled.set(true);
            AtlasLlamaNative.cancel(active.handle);
        }
    }

    synchronized void close() {
        closed = true;
        cancel(null);
        worker.shutdown();
    }
}
