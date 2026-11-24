package com.lifeatlas.app.ai;

import android.app.ActivityManager;
import android.content.*;
import android.content.res.Configuration;
import android.os.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import org.json.*;

/** One model and one worker for both the WebView and native voice coordinator. */
public final class AtlasInferenceRuntime implements ComponentCallbacks2 {
  private static AtlasInferenceRuntime instance;

  public static synchronized AtlasInferenceRuntime get(Context c) {
    if (instance == null) instance = new AtlasInferenceRuntime(c.getApplicationContext());
    return instance;
  }

  public interface Stream {
    void token(String token);

    default void stage(String name, double elapsedRealtimeMs) {}
  }

  private final Context context;
  private final ExecutorService worker = Executors.newSingleThreadExecutor();
  private final ScheduledExecutorService idle = Executors.newSingleThreadScheduledExecutor();
  private final AtomicBoolean busy = new AtomicBoolean();
  private final AtomicBoolean switching = new AtomicBoolean();
  private final AtomicLong epoch = new AtomicLong();
  private volatile String state = "unloaded", loaded = "", activeRequest = "", error = "";
  private volatile long lastUsed = SystemClock.elapsedRealtime();
  private volatile JSONObject loadedOptions = new JSONObject();
  private ScheduledFuture<?> idleUnload;

  private AtlasInferenceRuntime(Context c) {
    context = c;
    c.registerComponentCallbacks(this);
    if (Build.VERSION.SDK_INT >= 29) {
      PowerManager power = (PowerManager) c.getSystemService(Context.POWER_SERVICE);
      if (power != null)
        power.addThermalStatusListener(
            status -> {
              if (status >= PowerManager.THERMAL_STATUS_SEVERE) cancel("");
            });
    }
  }

  public JSONObject policy() {
    try {
      return new JSONObject(
          context
              .getSharedPreferences("atlas-inference", 0)
              .getString(
                  "policy", "{\"idleSeconds\":120,\"keepResident\":false,\"streaming\":true}"));
    } catch (Exception e) {
      return new JSONObject();
    }
  }

  public synchronized void setPolicy(JSONObject value) throws Exception {
    int seconds = value.optInt("idleSeconds", 120);
    if (seconds < 30 || seconds > 1800)
      throw new IllegalArgumentException("Idle timeout must be 30–1800 seconds");
    JSONObject safe =
        new JSONObject()
            .put("idleSeconds", seconds)
            .put("keepResident", value.optBoolean("keepResident", false))
            .put("streaming", value.optBoolean("streaming", true));
    context
        .getSharedPreferences("atlas-inference", 0)
        .edit()
        .putString("policy", safe.toString())
        .apply();
    scheduleIdle();
  }

  private synchronized void scheduleIdle() {
    if (idleUnload != null) idleUnload.cancel(false);
    idleUnload = null;
    JSONObject p = policy();
    if (loaded.isEmpty() || p.optBoolean("keepResident", false)) return;
    idleUnload =
        idle.schedule(
            () -> {
              if (!busy.get()) unload();
            },
            p.optInt("idleSeconds", 120),
            TimeUnit.SECONDS);
  }

  public JSONObject options() {
    try {
      return new JSONObject(
          context.getSharedPreferences("atlas-inference", 0).getString("options", "{}"));
    } catch (Exception e) {
      return new JSONObject();
    }
  }

  public synchronized void configure(JSONObject value) throws Exception {
    // Native Config::parse is authoritative; reject unknown controls at the bridge as well.
    String[] allowed = {
      "threads",
      "context",
      "maxTokens",
      "batch",
      "temperature",
      "topP",
      "topK",
      "repetition",
      "seed",
      "chatTemplate",
      "gpuLayers",
      "thinking"
    };
    java.util.Set<String> keys = new java.util.HashSet<>(java.util.Arrays.asList(allowed));
    for (java.util.Iterator<String> i = value.keys(); i.hasNext(); )
      if (!keys.contains(i.next())) throw new IllegalArgumentException("Unknown inference setting");
    if (busy.get() || switching.get())
      throw new IllegalStateException("Wait for the current inference before changing settings");
    validate(value);
    context
        .getSharedPreferences("atlas-inference", 0)
        .edit()
        .putString("options", value.toString())
        .apply();
    unload();
  }

  public static void validate(JSONObject v) {
    for (String key :
        new String[] {"threads", "context", "maxTokens", "batch", "topK", "seed", "gpuLayers"})
      if (v.has(key)) {
        Object raw = v.opt(key);
        if (!(raw instanceof Number))
          throw new IllegalArgumentException("Integer setting required");
        double value = ((Number) raw).doubleValue();
        if (!Double.isFinite(value)
            || value != Math.rint(value)
            || value < (key.equals("seed") ? 0 : Integer.MIN_VALUE)
            || value > (key.equals("seed") ? 4294967295L : Integer.MAX_VALUE))
          throw new IllegalArgumentException("Integer setting out of range");
      }

    int threads = v.optInt("threads", 4),
        ctx = v.optInt("context", 2048),
        max = v.optInt("maxTokens", 128),
        batch = v.optInt("batch", 128);
    double temp = v.optDouble("temperature", .7),
        top = v.optDouble("topP", .9),
        repeat = v.optDouble("repetition", 1.1);
    if (threads < 1
        || threads > 8
        || ctx < 512
        || ctx > 4096
        || max < 1
        || max > 1024
        || max >= ctx
        || batch < 1
        || batch > 512
        || batch > ctx
        || !Double.isFinite(temp)
        || temp < 0
        || temp > 2
        || !Double.isFinite(top)
        || top <= 0
        || top > 1
        || !Double.isFinite(repeat)
        || repeat < 1
        || repeat > 2
        || v.optInt("topK", 40) < 1
        || v.optInt("topK", 40) > 200
        || v.optInt("gpuLayers", 0) != 0)
      throw new IllegalArgumentException("Inference settings exceed supported CPU limits");
  }

  public JSONObject status() {
    JSONObject s = new JSONObject();
    try {
      ActivityManager.MemoryInfo memory = new ActivityManager.MemoryInfo();
      ((ActivityManager) context.getSystemService(Context.ACTIVITY_SERVICE)).getMemoryInfo(memory);
      PowerManager power = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
      s.put(
              "available",
              AtlasLlamaNative.AVAILABLE && !AtlasModelStore.get(context).selected().isEmpty())
          .put("engine", AtlasLlamaNative.AVAILABLE ? AtlasLlamaNative.VERSION : "none")
          .put("state", state)
          .put("selected", AtlasModelStore.get(context).selected())
          .put("loaded", loaded)
          .put("busy", busy.get())
          .put("error", error)
          .put(
              "reason",
              AtlasLlamaNative.AVAILABLE
                  ? (AtlasModelStore.get(context).selected().isEmpty()
                      ? "Choose an installed GGUF model"
                      : "Offline CPU runtime; models load on demand")
                  : "Native inference library is unavailable for this architecture")
          .put("availableMemoryBytes", memory.availMem)
          .put("totalMemoryBytes", memory.totalMem)
          .put("processPssBytes", Debug.getPss() * 1024L)
          .put("lowMemory", memory.lowMemory)
          .put("backend", "cpu")
          .put("gpuAvailable", false)
          .put("threadsAvailable", Runtime.getRuntime().availableProcessors())
          .put(
              "thermalStatus",
              Build.VERSION.SDK_INT >= 29 && power != null
                  ? power.getCurrentThermalStatus()
                  : JSONObject.NULL)
          .put("options", options())
          .put("policy", policy())
          .put("nativeHeapBytes", Debug.getNativeHeapAllocatedSize())
          .put(
              "device",
              new JSONObject()
                  .put("manufacturer", Build.MANUFACTURER)
                  .put("model", Build.MODEL)
                  .put("androidSdk", Build.VERSION.SDK_INT)
                  .put("androidRelease", Build.VERSION.RELEASE)
                  .put("abis", new JSONArray(java.util.Arrays.asList(Build.SUPPORTED_ABIS)))
                  .put(
                      "emulatorHeuristic",
                      Build.FINGERPRINT.contains("generic") || Build.MODEL.contains("sdk_gphone")));
      android.content.Intent battery =
          context.registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
      if (battery != null)
        s.put("batteryLevel", battery.getIntExtra(BatteryManager.EXTRA_LEVEL, -1))
            .put(
                "batteryTemperatureC",
                battery.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, 0) / 10.0);
    } catch (Exception ignored) {
    }
    return s;
  }

  private void guard(long expected) throws Exception {
    if (epoch.get() != expected) throw new CancellationException("Inference canceled");
    if (!AtlasLlamaNative.AVAILABLE)
      throw new IllegalStateException("Native CPU runtime unavailable");
  }

  private void ensureLoaded(long expected) throws Exception {
    ensureLoaded(expected, token -> {});
  }

  private void ensureLoaded(long expected, Stream stream) throws Exception {
    guard(expected);
    if (Build.VERSION.SDK_INT >= 29
        && ((PowerManager) context.getSystemService(Context.POWER_SERVICE))
                .getCurrentThermalStatus()
            >= PowerManager.THERMAL_STATUS_SEVERE)
      throw new IllegalStateException("Let the phone cool before running a model");
    AtlasModelStore store = AtlasModelStore.get(context);
    String selected = store.selected();
    if (selected.isEmpty())
      throw new IllegalStateException("Choose an installed model in Intelligence Lab");
    if (loaded.equals(selected)) return;
    state = "verifying";
    java.io.File file = store.verifiedFile(selected);
    guard(expected);
    ActivityManager.MemoryInfo memory = new ActivityManager.MemoryInfo();
    ((ActivityManager) context.getSystemService(Context.ACTIVITY_SERVICE)).getMemoryInfo(memory);
    if (memory.lowMemory || memory.availMem < file.length() + 384L * 1024 * 1024)
      throw new IllegalStateException(
          "Not enough available memory; close other apps or choose a smaller model");
    if (Build.VERSION.SDK_INT >= 29
        && ((PowerManager) context.getSystemService(Context.POWER_SERVICE))
                .getCurrentThermalStatus()
            >= PowerManager.THERMAL_STATUS_SEVERE)
      throw new IllegalStateException("Let the phone cool before loading a model");
    state = "loading";
    loaded = "";
    JSONObject config = options();
    JSONObject metadata = store.entry(selected);
    if ((!config.has("chatTemplate") || "model".equals(config.optString("chatTemplate")))
        && metadata.has("chatTemplate"))
      config.put("chatTemplate", metadata.getString("chatTemplate"));
    stream.stage("modelLoadStart", SystemClock.elapsedRealtime());
    AtlasLlamaNative.load(file.getAbsolutePath(), config.toString());
    stream.stage("modelLoadEnd", SystemClock.elapsedRealtime());
    try {
      guard(expected);
    } catch (Exception canceled) {
      AtlasLlamaNative.unload();
      throw canceled;
    }
    loadedOptions = config;
    loaded = selected;
    state = "ready";
  }

  private <T> CompletableFuture<T> operation(Callable<T> task) {
    return operation("", task);
  }

  private synchronized <T> CompletableFuture<T> operation(String request, Callable<T> task) {
    CompletableFuture<T> result = new CompletableFuture<>();
    if (switching.get() || !busy.compareAndSet(false, true)) {
      result.completeExceptionally(new IllegalStateException("Another inference is running"));
      return result;
    }
    activeRequest = request;
    worker.execute(
        () -> {
          T value = null;
          Throwable failure = null;
          try {
            error = "";
            value = task.call();
          } catch (Throwable e) {
            failure = e;
            error =
                e instanceof CancellationException
                    ? "Inference canceled"
                    : "Local inference failed. Check the model, context budget and available"
                        + " memory.";
            state = loaded.isEmpty() ? "error" : "ready";
          } finally {
            activeRequest = "";
            lastUsed = SystemClock.elapsedRealtime();
            busy.set(false);
            scheduleIdle();
          }
          if (failure == null) result.complete(value);
          else result.completeExceptionally(failure);
        });
    return result;
  }

  public CompletableFuture<Void> selectModel(String id) {
    return changeModel(id, false);
  }

  public CompletableFuture<Void> removeModel(String id) {
    return changeModel(id, true);
  }

  private synchronized CompletableFuture<Void> changeModel(String id, boolean remove) {
    CompletableFuture<Void> result = new CompletableFuture<>();
    if (!switching.compareAndSet(false, true)) {
      result.completeExceptionally(
          new IllegalStateException("Model switching is already in progress"));
      return result;
    }
    cancel("");
    worker.execute(
        () -> {
          Throwable failure = null;
          try {
            AtlasModelStore store = AtlasModelStore.get(context);
            if (!remove && !id.isEmpty()) store.verifiedFile(id);
            if (!remove || loaded.equals(id)) {
              if (AtlasLlamaNative.AVAILABLE) AtlasLlamaNative.unload();
              loaded = "";
              state = "unloaded";
            }
            if (remove) store.remove(id);
            else store.selected(id);
            scheduleIdle();
          } catch (Throwable e) {
            failure = e;
          } finally {
            switching.set(false);
          }
          if (failure == null) result.complete(null);
          else result.completeExceptionally(failure);
        });
    return result;
  }

  public CompletableFuture<JSONObject> load() {
    long expected = epoch.get();
    return operation(
        () -> {
          AtlasLlamaNative.begin();
          guard(expected);
          ensureLoaded(expected);
          return status();
        });
  }

  public CompletableFuture<JSONObject> generate(
      String request, JSONArray messages, JSONObject override, boolean structured, Stream stream) {
    long expected = epoch.get();
    return operation(
        request,
        () -> {
          AtlasLlamaNative.begin();
          guard(expected);
          ensureLoaded(expected, stream);
          JSONObject config = new JSONObject(loadedOptions.toString());
          if (override != null)
            for (java.util.Iterator<String> it = override.keys(); it.hasNext(); ) {
              String key = it.next();
              if (key.equals("chatTemplate") && "model".equals(override.optString(key))) continue;
              config.put(key, override.get(key));
            }
          validate(config);
          state = "generating";
          guard(expected);
          final double nativeStart = SystemClock.elapsedRealtime();
          JSONObject response =
              new JSONObject(
                  AtlasLlamaNative.generate(
                      messages.toString(),
                      config.toString(),
                      structured,
                      event -> {
                        if (epoch.get() == expected)
                          try {
                            JSONObject value = new JSONObject(event);
                            if (value.has("stage"))
                              stream.stage(
                                  value.getString("stage"), nativeStart + value.getDouble("atMs"));
                            else stream.token(value.getString("token"));
                          } catch (JSONException e) {
                            throw new IllegalStateException("Invalid native stream");
                          }
                      }));
          guard(expected);
          state = "ready";
          JSONObject metrics = response.getJSONObject("metrics");
          metrics.put("processPssBytes", Debug.getPss() * 1024L).put("modelId", loaded);
          return response;
        });
  }

  public void cancel(String request) {
    if (request == null || request.isEmpty() || request.equals(activeRequest)) {
      epoch.incrementAndGet();
      if (AtlasLlamaNative.AVAILABLE) AtlasLlamaNative.cancel();
    }
  }

  public CompletableFuture<Void> unload() {
    cancel("");
    CompletableFuture<Void> f = new CompletableFuture<>();
    worker.execute(
        () -> {
          try {
            if (AtlasLlamaNative.AVAILABLE) AtlasLlamaNative.unload();
            loaded = "";
            state = "unloaded";
            scheduleIdle();
            f.complete(null);
          } catch (Throwable e) {
            f.completeExceptionally(e);
          }
        });
    return f;
  }

  public CompletableFuture<Void> reset() {
    CompletableFuture<Void> f = new CompletableFuture<>();
    worker.execute(
        () -> {
          try {
            if (AtlasLlamaNative.AVAILABLE) AtlasLlamaNative.reset();
            f.complete(null);
          } catch (Throwable e) {
            f.completeExceptionally(e);
          }
        });
    return f;
  }

  @Override
  public void onTrimMemory(int level) {
    if (level == ComponentCallbacks2.TRIM_MEMORY_RUNNING_LOW
        || level == ComponentCallbacks2.TRIM_MEMORY_RUNNING_CRITICAL
        || level >= ComponentCallbacks2.TRIM_MEMORY_BACKGROUND) unload();
  }

  @Override
  public void onLowMemory() {
    unload();
  }

  @Override
  public void onConfigurationChanged(Configuration ignored) {}
}
