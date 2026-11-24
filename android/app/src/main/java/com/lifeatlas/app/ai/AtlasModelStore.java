package com.lifeatlas.app.ai;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.SystemClock;
import java.io.*;
import java.net.*;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import org.json.JSONArray;
import org.json.JSONObject;

/** Process-owned, native filesystem model storage. No model bytes cross the WebView. */
public final class AtlasModelStore {
  private static AtlasModelStore instance;

  public static synchronized AtlasModelStore get(Context context) {
    if (instance == null) instance = new AtlasModelStore(context.getApplicationContext());
    return instance;
  }

  interface DownloadEnvironment {
    HttpURLConnection open(URL url) throws IOException;

    boolean connected(boolean wifiOnly);

    long usableSpace(File directory);
  }

  private final DownloadEnvironment environment;
  private final JSONArray catalogueOverride;
  private final Context context;
  private final File directory;
  private final ExecutorService transfers = Executors.newSingleThreadExecutor();
  private final ConcurrentHashMap<String, JSONObject> states = new ConcurrentHashMap<>();
  private final ConcurrentHashMap<String, AtomicBoolean> stops = new ConcurrentHashMap<>();
  private final ConcurrentHashMap<String, HttpURLConnection> connections =
      new ConcurrentHashMap<>();
  private final ConcurrentHashMap<String, CompletableFuture<JSONObject>> jobs =
      new ConcurrentHashMap<>();
  private final Map<String, String> verified = new ConcurrentHashMap<>();
  public static final long MAX_BYTES = 3500000000L;

  private AtlasModelStore(Context context) {
    this(
        context,
        null,
        new DownloadEnvironment() {
          public HttpURLConnection open(URL url) throws IOException {
            return (HttpURLConnection) url.openConnection();
          }

          public long usableSpace(File directory) {
            return directory.getUsableSpace();
          }

          public boolean connected(boolean wifiOnly) {
            ConnectivityManager network =
                (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
            if (network == null) return false;
            NetworkCapabilities capabilities =
                network.getNetworkCapabilities(network.getActiveNetwork());
            return capabilities != null
                && (!wifiOnly || capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI));
          }
        });
  }

  // Package-private seam exercises the production transfer state machine without real model
  // downloads.
  AtlasModelStore(Context context, JSONArray catalogue, DownloadEnvironment environment) {
    this.context = context;
    this.environment = environment;
    this.catalogueOverride = catalogue;
    directory = new File(context.getNoBackupFilesDir(), "atlas-models");
    directory.mkdirs();
    // Interrupted imports have no reusable source grant. Keep resumable downloads intact.
    File[] imports =
        directory.listFiles((dir, name) -> name.matches("import-[a-f0-9-]{36}\\.part"));
    if (imports != null) for (File file : imports) file.delete();
  }

  private static String validId(String id) throws IOException {
    if (id == null || !id.matches("[a-z0-9-]{1,80}"))
      throw new IOException("Invalid model identifier");
    return id;
  }

  private File sidecar(String id) throws IOException {
    return new File(directory, validId(id) + ".json");
  }

  private static String readText(InputStream in) throws IOException {
    ByteArrayOutputStream out = new ByteArrayOutputStream();
    byte[] b = new byte[4096];
    int n;
    while ((n = in.read(b)) != -1) {
      if (out.size() + n > 262144) throw new IOException("Model metadata exceeds limit");
      out.write(b, 0, n);
    }
    return out.toString("UTF-8");
  }

  private static JSONObject read(File file) throws Exception {
    try (InputStream in = new FileInputStream(file)) {
      return new JSONObject(readText(in));
    }
  }

  private JSONArray catalogue() throws Exception {
    if (catalogueOverride != null) return new JSONArray(catalogueOverride.toString());
    try (InputStream in = context.getAssets().open("atlas-model-catalogue.json")) {
      return new JSONArray(readText(in));
    }
  }

  public synchronized JSONObject entry(String id) throws Exception {
    validId(id);
    {
      JSONArray list = catalogue();
      for (int i = 0; i < list.length(); i++) {
        JSONObject item = list.getJSONObject(i);
        if (id.equals(item.getString("id"))) return item;
      }
    }
    File meta = sidecar(id);
    if (meta.isFile()) return read(meta);
    throw new IOException("Unknown model. Import a GGUF or choose a verified catalogue entry.");
  }

  public synchronized File file(String id) throws Exception {
    JSONObject m = entry(id);
    String sha = m.getString("sha256");
    if (!sha.matches("[a-f0-9]{64}")) throw new IOException("Invalid checksum metadata");
    return new File(directory, sha + ".gguf");
  }

  private synchronized void save(String id, JSONObject value) throws Exception {
    File temp = new File(directory, validId(id) + ".json.tmp");
    try (FileOutputStream out = new FileOutputStream(temp)) {
      out.write(value.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
      out.getFD().sync();
    }
    if (!temp.renameTo(sidecar(id)))
      throw new IOException("Could not save model metadata atomically");
  }

  public static String hash(File file) throws Exception {
    MessageDigest d = MessageDigest.getInstance("SHA-256");
    try (InputStream in = new FileInputStream(file)) {
      byte[] b = new byte[262144];
      int n;
      while ((n = in.read(b)) != -1) d.update(b, 0, n);
    }
    StringBuilder result = new StringBuilder();
    for (byte b : d.digest()) result.append(String.format(java.util.Locale.ROOT, "%02x", b));
    return result.toString();
  }

  public synchronized File verifiedFile(String id) throws Exception {
    JSONObject m = entry(id);
    File f = file(id);
    if (!f.isFile() || f.length() != m.getLong("bytes"))
      throw new IOException("Model is missing or incomplete");
    String stamp = f.length() + ":" + f.lastModified();
    if (!stamp.equals(verified.get(id))) {
      if (!hash(f).equals(m.getString("sha256")))
        throw new IOException("Model checksum failed. Remove it and download/import again.");
      verified.put(id, stamp);
    }
    return f;
  }

  public synchronized JSONArray list() throws Exception {
    JSONArray out = new JSONArray();
    Set<String> ids = new LinkedHashSet<>();
    {
      JSONArray catalogue = catalogue();
      for (int i = 0; i < catalogue.length(); i++)
        ids.add(catalogue.getJSONObject(i).getString("id"));
    }
    File[] saved = directory.listFiles((d, name) -> name.endsWith(".json"));
    if (saved != null)
      for (File f : saved) ids.add(f.getName().substring(0, f.getName().length() - 5));
    for (String id : ids) {
      JSONObject m = entry(id);
      File f = file(id);
      JSONObject state = states.get(id);
      m.put("installed", f.isFile() && f.length() == m.optLong("bytes"));
      m.put(
          "state",
          state != null
              ? state.optString("state")
              : (m.optBoolean("installed")
                  ? "installed"
                  : (new File(directory, id + ".part").length() > 0 ? "paused" : "not_installed")));
      if (state != null) m.put("transfer", state);
      File part = new File(directory, id + ".part");
      m.put("partialBytes", part.isFile() ? part.length() : 0);
      out.put(m);
    }
    return out;
  }

  public String selected() {
    return context.getSharedPreferences("atlas-model-selection", 0).getString("id", "");
  }

  public void selected(String id) {
    context.getSharedPreferences("atlas-model-selection", 0).edit().putString("id", id).apply();
  }

  public boolean active() {
    return !jobs.isEmpty();
  }

  public JSONObject transfer(String id) {
    JSONObject s = states.get(id);
    return s == null ? new JSONObject() : s;
  }

  private void state(
      String id, String status, long received, long total, long start, long initial, String error) {
    try {
      double seconds = Math.max(.001, (SystemClock.elapsedRealtime() - start) / 1000.0);
      states.put(
          id,
          new JSONObject()
              .put("id", id)
              .put("name", names.getOrDefault(id, id))
              .put("kind", id.matches("import-[a-f0-9-]{36}") ? "import" : "download")
              .put("state", status)
              .put("updatedAt", System.currentTimeMillis())
              .put("received", received)
              .put("total", total)
              .put("remaining", Math.max(0, total - received))
              .put("bytesPerSecond", Math.max(0, received - initial) / seconds)
              .put("error", error == null ? JSONObject.NULL : error));
    } catch (Exception ignored) {
    }
  }

  private final ScheduledExecutorService recovery = Executors.newSingleThreadScheduledExecutor();
  private final ConcurrentHashMap<String, ScheduledFuture<?>> pendingRetries =
      new ConcurrentHashMap<>();
  private final Set<String> running = ConcurrentHashMap.newKeySet(),
      discard = ConcurrentHashMap.newKeySet();
  private final ConcurrentHashMap<String, InputStream> inputs = new ConcurrentHashMap<>();
  private final ConcurrentHashMap<String, String> names = new ConcurrentHashMap<>();

  private static final class TransientDownload extends IOException {
    final long retrySeconds;

    TransientDownload(String message) {
      this(message, 0);
    }

    TransientDownload(String message, long retrySeconds) {
      super(message);
      this.retrySeconds = retrySeconds;
    }
  }

  void closeForTests() {
    for (String id : new ArrayList<>(jobs.keySet())) pause(id);
    recovery.shutdownNow();
    transfers.shutdownNow();
  }

  public JSONArray transferList() {
    JSONArray result = new JSONArray();
    List<String> terminal = new ArrayList<>();
    for (Map.Entry<String, JSONObject> item : states.entrySet()) {
      if (jobs.containsKey(item.getKey())) result.put(item.getValue());
      else terminal.add(item.getKey());
    }
    terminal.sort(Comparator.comparingLong(id -> states.get(id).optLong("updatedAt")));
    for (int i = 0; i < terminal.size(); i++) {
      String id = terminal.get(i);
      if (i < Math.max(0, terminal.size() - 20)) {
        states.remove(id);
        names.remove(id);
      } else {
        JSONObject value = states.get(id);
        if (value != null) result.put(value);
      }
    }
    return result;
  }

  private void closeTransfer(String id) {
    HttpURLConnection connection = connections.remove(id);
    if (connection != null) connection.disconnect();
    InputStream input = inputs.remove(id);
    if (input != null)
      try {
        input.close();
      } catch (IOException ignored) {
      }
  }

  public void pause(String id) {
    CompletableFuture<JSONObject> job;
    synchronized (jobs) {
      job = jobs.get(id);
      AtomicBoolean stop = stops.get(id);
      if (stop == null) return;
      stop.set(true);
      ScheduledFuture<?> retry = pendingRetries.remove(id);
      if (retry != null) retry.cancel(false);
    }
    closeTransfer(id);
    synchronized (jobs) {
      if (job != null && jobs.get(id) == job && !running.contains(id))
        finishTransfer(id, job, null, new CancellationException("Paused"));
    }
  }

  public void cancel(String id) throws Exception {
    validId(id);
    discard.add(id);
    pause(id);
    synchronized (jobs) {
      if (!jobs.containsKey(id)) {
        new File(directory, id + ".part").delete();
        discard.remove(id);
      }
    }
  }

  private void finishTransfer(
      String id, CompletableFuture<JSONObject> job, JSONObject value, Throwable error) {
    synchronized (jobs) {
      if (jobs.get(id) != job) return;
      closeTransfer(id);
      running.remove(id);
      ScheduledFuture<?> retry = pendingRetries.remove(id);
      if (retry != null) retry.cancel(false);
      boolean canceled = discard.remove(id);
      AtomicBoolean stop = stops.remove(id);
      if (canceled) new File(directory, id + ".part").delete();
      if (error != null) {
        JSONObject previous = states.get(id);
        long total = previous == null ? 0 : previous.optLong("total");
        state(
            id,
            canceled ? "canceled" : stop != null && stop.get() ? "paused" : "failed",
            new File(directory, id + ".part").length(),
            total,
            SystemClock.elapsedRealtime(),
            0,
            canceled ? "Canceled" : stop != null && stop.get() ? "Paused" : transferError(error));
      }
      jobs.remove(id);
    }
    if (error == null) job.complete(value);
    else job.completeExceptionally(error);
  }

  private static String transferError(Throwable error) {
    String message = error.getMessage() == null ? "" : error.getMessage();
    if (message.contains("storage") || message.contains("storage budget"))
      return "Not enough free storage. Free space and retry; downloaded partial bytes are"
                 + " retained.";
    if (message.contains("SHA-256") || message.contains("Corrupted partial"))
      return "Checksum failed. The corrupted partial was removed; retry with a trusted source.";
    if (message.contains("Not a GGUF")) return "The selected file is not a GGUF model.";
    if (message.contains("Incomplete") || error instanceof TransientDownload)
      return "Network recovery timed out. Retry to resume the saved download.";
    return "Transfer stopped. Check storage, connectivity and file integrity, then retry.";
  }

  public CompletableFuture<JSONObject> download(String id, boolean consent, boolean wifiOnly) {
    synchronized (jobs) {
      if (jobs.containsKey(id)) return jobs.get(id);
      CompletableFuture<JSONObject> job = new CompletableFuture<>();
      AtomicBoolean stop = new AtomicBoolean();
      jobs.put(id, job);
      stops.put(id, stop);
      discard.remove(id);
      state(id, "queued", 0, 0, SystemClock.elapsedRealtime(), 0, null);
      transfers.execute(() -> downloadAttempt(id, job, stop, consent, wifiOnly, 0));
      return job;
    }
  }

  private void downloadAttempt(
      String id,
      CompletableFuture<JSONObject> job,
      AtomicBoolean stop,
      boolean consent,
      boolean wifiOnly,
      int attempt) {
    synchronized (jobs) {
      if (jobs.get(id) != job) return;
      if (stop.get()) {
        finishTransfer(id, job, null, new CancellationException("Paused"));
        return;
      }
      running.add(id);
    }
    JSONObject value = null;
    Throwable failure = null;
    try {
      value = downloadOnce(id, consent, wifiOnly, stop);
    } catch (Throwable e) {
      failure = e;
    } finally {
      closeTransfer(id);
      running.remove(id);
    }
    boolean retryable =
        failure instanceof TransientDownload
            || failure instanceof SocketException
            || failure instanceof SocketTimeoutException
            || failure instanceof UnknownHostException;
    synchronized (jobs) {
      if (jobs.get(id) != job) return;
      if (retryable && !stop.get() && attempt < 5) {
        long bytes = new File(directory, id + ".part").length();
        JSONObject previous = states.get(id);
        long total = previous == null ? 0 : previous.optLong("total");
        state(
            id,
            "retrying",
            bytes,
            total,
            SystemClock.elapsedRealtime(),
            bytes,
            "Connection interrupted. Retrying automatically.");
        pendingRetries.put(
            id,
            recovery.schedule(
                () ->
                    transfers.execute(
                        () -> downloadAttempt(id, job, stop, consent, wifiOnly, attempt + 1)),
                Math.max(
                    1L << attempt,
                    failure instanceof TransientDownload
                        ? ((TransientDownload) failure).retrySeconds
                        : 0),
                TimeUnit.SECONDS));
        return;
      }
    }
    finishTransfer(id, job, value, failure);
  }

  private JSONObject downloadOnce(String id, boolean consent, boolean wifiOnly, AtomicBoolean stop)
      throws Exception {
    if (!consent) throw new IOException("Download and license confirmation required");
    if (stop.get()) throw new CancellationException("Paused");
    JSONObject m = entry(id);
    names.put(id, m.optString("name", id));
    File target = file(id);
    if (target.isFile()) {
      verifiedFile(id);
      state(
          id,
          "installed",
          target.length(),
          target.length(),
          SystemClock.elapsedRealtime(),
          target.length(),
          null);
      return m;
    }
    if (!m.optBoolean("downloadable", true))
      throw new IOException("Artifact not approved for download");
    String repo = m.getString("repository"),
        rev = m.getString("revision"),
        name = m.getString("filename"),
        sha = m.getString("sha256");
    long total = m.getLong("bytes");
    if (!repo.matches("[\\w.-]+/[\\w.-]+")
        || !rev.matches("[a-f0-9]{40}")
        || !name.matches("[\\w.-]+\\.gguf")
        || !sha.matches("[a-f0-9]{64}")
        || total <= 0
        || total > MAX_BYTES) throw new IOException("Unverified artifact metadata");
    File part = new File(directory, validId(id) + ".part");
    long offset = part.length(), started = SystemClock.elapsedRealtime();
    if (offset >= total) {
      if (offset == total && hash(part).equals(sha)) {
        if (!part.renameTo(target)) throw new IOException("Installation failed");
        save(id, m);
        state(id, "installed", total, total, started, total, null);
        return m;
      }
      part.delete();
      throw new IOException("Corrupted partial removed. Retry the download.");
    }
    if (environment.usableSpace(directory) < total - offset + 67108864L)
      throw new IOException("Not enough free storage");
    if (!environment.connected(wifiOnly)) throw new TransientDownload("Waiting for network");
    URL url = new URL("https://huggingface.co/" + repo + "/resolve/" + rev + "/" + name);
    HttpURLConnection connection = null;
    for (int redirects = 0; redirects <= 8; redirects++) {
      if (stop.get()) throw new CancellationException("Paused");
      if (!AtlasDownloadRules.approved(url)) throw new IOException("Unapproved download host");
      connection = environment.open(url);
      connections.put(id, connection);
      connection.setInstanceFollowRedirects(false);
      connection.setConnectTimeout(20000);
      connection.setReadTimeout(20000);
      if (offset > 0) connection.setRequestProperty("Range", "bytes=" + offset + "-");
      int code = connection.getResponseCode();
      if (code >= 300 && code < 400) {
        String next = connection.getHeaderField("Location");
        connection.disconnect();
        if (next == null || redirects == 8) throw new IOException("Invalid redirect");
        url = new URL(url, next);
        continue;
      }
      if (code == 408 || code == 429 || code >= 500) {
        long retrySeconds = 0;
        try {
          retrySeconds =
              Math.min(120, Math.max(0, Long.parseLong(connection.getHeaderField("Retry-After"))));
        } catch (Exception ignored) {
        }
        throw new TransientDownload("Temporary model server failure", retrySeconds);
      }
      if (code != 200 && code != 206) throw new IOException("Model server rejected request");
      if (code == 200) offset = 0;
      else if (!AtlasDownloadRules.resumedRange(
          connection.getHeaderField("Content-Range"), offset, total))
        throw new IOException("Invalid resumed response");
      break;
    }
    long received = offset, last = 0;
    state(id, "downloading", received, total, started, offset, null);
    try (InputStream in = connection.getInputStream();
        FileOutputStream out = new FileOutputStream(part, offset > 0)) {
      inputs.put(id, in);
      byte[] buffer = new byte[131072];
      int n;
      while ((n = readNetwork(in, buffer)) != -1) {
        if (stop.get()) throw new CancellationException("Paused");
        if (environment.usableSpace(directory) < n + 8388608L)
          throw new IOException("Not enough free storage");
        received += n;
        if (received > total) throw new IOException("Download exceeded verified size");
        out.write(buffer, 0, n);
        long now = SystemClock.elapsedRealtime();
        if (now - last > 250) {
          state(id, "downloading", received, total, started, offset, null);
          last = now;
        }
      }
      out.getFD().sync();
    }
    inputs.remove(id);
    if (stop.get()) throw new CancellationException("Paused");
    if (part.length() != total) throw new TransientDownload("Incomplete download");
    state(id, "verifying", total, total, started, offset, null);
    if (!hash(part).equals(sha)) {
      part.delete();
      throw new IOException("SHA-256 mismatch");
    }
    if (stop.get()) throw new CancellationException("Paused");
    if (!part.renameTo(target)) throw new IOException("Atomic installation failed");
    save(id, m);
    verified.put(id, target.length() + ":" + target.lastModified());
    state(id, "installed", total, total, started, offset, null);
    return m;
  }

  private static int readNetwork(InputStream input, byte[] buffer) throws IOException {
    try {
      return input.read(buffer);
    } catch (IOException error) {
      throw new TransientDownload("Network stream interrupted");
    }
  }

  public String startImport(Uri uri, String name, boolean consent) {
    String id = "import-" + UUID.randomUUID();
    importFile(id, uri, name, consent);
    return id;
  }

  public CompletableFuture<JSONObject> importFile(Uri uri, String name, boolean consent) {
    return importFile("import-" + UUID.randomUUID(), uri, name, consent);
  }

  private CompletableFuture<JSONObject> importFile(
      String transferId, Uri uri, String name, boolean consent) {
    CompletableFuture<JSONObject> job = new CompletableFuture<>();
    AtomicBoolean stop = new AtomicBoolean();
    synchronized (jobs) {
      jobs.put(transferId, job);
      stops.put(transferId, stop);
      names.put(transferId, name == null ? "Imported model" : name);
      state(transferId, "queued", 0, 0, SystemClock.elapsedRealtime(), 0, null);
    }
    transfers.execute(
        () -> {
          synchronized (jobs) {
            if (jobs.get(transferId) != job) return;
            running.add(transferId);
          }
          File part = new File(directory, transferId + ".part");
          JSONObject result = null;
          Throwable failure = null;
          long expected = 0, received = 0, start = SystemClock.elapsedRealtime(), last = 0;
          try {
            if (!consent) throw new IOException("Import confirmation required");
            if (stop.get()) throw new CancellationException("Import canceled");
            try (android.database.Cursor cursor =
                context
                    .getContentResolver()
                    .query(
                        uri,
                        new String[] {android.provider.OpenableColumns.SIZE},
                        null,
                        null,
                        null)) {
              if (cursor != null && cursor.moveToFirst() && !cursor.isNull(0))
                expected = Math.max(0, cursor.getLong(0));
            } catch (Exception ignored) {
            }
            if (expected > MAX_BYTES
                || expected > 0 && environment.usableSpace(directory) < expected + 67108864L)
              throw new IOException("Not enough storage for this model");
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            state(transferId, "importing", 0, expected, start, 0, null);
            try (InputStream in = context.getContentResolver().openInputStream(uri);
                FileOutputStream out = new FileOutputStream(part)) {
              if (in == null) throw new IOException("Could not open selected file");
              inputs.put(transferId, in);
              byte[] buffer = new byte[131072];
              int n;
              while ((n = in.read(buffer)) != -1) {
                if (stop.get()) throw new CancellationException("Import canceled");
                received += n;
                if (received > MAX_BYTES || environment.usableSpace(directory) < n + 8388608L)
                  throw new IOException("Import exceeds storage budget");
                out.write(buffer, 0, n);
                digest.update(buffer, 0, n);
                if (SystemClock.elapsedRealtime() - last > 250) {
                  state(transferId, "importing", received, expected, start, 0, null);
                  last = SystemClock.elapsedRealtime();
                }
              }
              out.getFD().sync();
            }
            if (stop.get()) throw new CancellationException("Import canceled");
            if (expected > 0 && received != expected)
              throw new IOException("Selected file changed or is incomplete");
            try (InputStream in = new FileInputStream(part)) {
              byte[] magic = new byte[4];
              if (in.read(magic) != 4 || !Arrays.equals(magic, new byte[] {'G', 'G', 'U', 'F'}))
                throw new IOException("Not a GGUF model");
            }
            StringBuilder value = new StringBuilder();
            for (byte b : digest.digest()) value.append(String.format(Locale.ROOT, "%02x", b));
            String sha = value.toString(), id = "import-" + sha;
            result =
                new JSONObject()
                    .put("id", id)
                    .put("name", name == null ? "Imported GGUF" : name)
                    .put("sha256", sha)
                    .put("bytes", received)
                    .put("integrity", "locally-calculated")
                    .put("downloadable", false)
                    .put("license", "User imported; source/license not independently verified")
                    .put("architecture", "runtime-detected")
                    .put("quantization", "runtime-detected");
            File dest = new File(directory, sha + ".gguf");
            if (dest.isFile()) {
              if (!hash(dest).equals(sha)) throw new IOException("Existing duplicate is corrupted");
              part.delete();
            } else if (!part.renameTo(dest)) throw new IOException("Atomic import failed");
            save(id, result);
            verified.put(id, dest.length() + ":" + dest.lastModified());
            state(transferId, "installed", received, received, start, 0, null);
          } catch (Throwable error) {
            failure = error;
          } finally {
            if (part.exists()) part.delete();
            finishTransfer(transferId, job, result, failure);
          }
        });
    return job;
  }

  public synchronized void remove(String id) throws Exception {
    if (jobs.containsKey(id))
      throw new IOException("Pause the transfer before deleting this model");
    File file = file(id);
    boolean shared = false;
    JSONArray entries = list();
    for (int i = 0; i < entries.length(); i++) {
      JSONObject other = entries.getJSONObject(i);
      if (!id.equals(other.getString("id"))
          && other.optBoolean("installed")
          && file(other.getString("id")).equals(file)) {
        shared = true;
        break;
      }
    }
    if (!shared && file.exists() && !file.delete()) throw new IOException("Could not remove model");
    sidecar(id).delete();
    new File(directory, id + ".part").delete();
    verified.remove(id);
    states.remove(id);
    if (selected().equals(id)) selected("");
  }
}
