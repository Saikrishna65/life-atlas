package com.lifeatlas.app.ai;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.Build;
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
    this.context = context;
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

  public synchronized JSONObject entry(String id) throws Exception {
    validId(id);
    try (InputStream in = context.getAssets().open("atlas-model-catalogue.json")) {
      JSONArray list = new JSONArray(readText(in));
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
    try (InputStream in = context.getAssets().open("atlas-model-catalogue.json")) {
      JSONArray catalogue = new JSONArray(readText(in));
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
              .put("state", status)
              .put("received", received)
              .put("total", total)
              .put("remaining", Math.max(0, total - received))
              .put("bytesPerSecond", Math.max(0, received - initial) / seconds)
              .put("error", error == null ? JSONObject.NULL : error));
    } catch (Exception ignored) {
    }
  }

  public void pause(String id) {
    AtomicBoolean stop = stops.get(id);
    if (stop != null) stop.set(true);
    HttpURLConnection c = connections.get(id);
    if (c != null) c.disconnect();
  }

  public void cancel(String id) throws Exception {
    pause(id);
    CompletableFuture<JSONObject> job = jobs.get(id);
    if (job != null)
      job.handle(
          (value, error) -> {
            new File(directory, id + ".part").delete();
            return null;
          });
    else new File(directory, validId(id) + ".part").delete();
  }

  public CompletableFuture<JSONObject> download(String id, boolean consent, boolean wifiOnly) {
    synchronized (jobs) {
      CompletableFuture<JSONObject> existing = jobs.get(id);
      if (existing != null) return existing;
      CompletableFuture<JSONObject> result = new CompletableFuture<>();
      jobs.put(id, result);
      AtomicBoolean stop = new AtomicBoolean();
      stops.put(id, stop);
      state(id, "queued", 0, 0, SystemClock.elapsedRealtime(), 0, null);
      transfers.execute(
          () -> {
            long start = SystemClock.elapsedRealtime(), initial = 0, total = 0;
            File part = null;
            try {
              if (!consent) throw new IOException("Confirm the model download and license first");
              JSONObject m = entry(id);
              if (file(id).isFile()) {
                verifiedFile(id);
                result.complete(m);
                return;
              }
              if (!m.optBoolean("downloadable", true))
                throw new IOException("This candidate is not a verified downloadable artifact");
              String repo = m.getString("repository"),
                  rev = m.getString("revision"),
                  name = m.getString("filename"),
                  sha = m.getString("sha256");
              total = m.getLong("bytes");
              if (!repo.matches("[\\w.-]+/[\\w.-]+")
                  || !rev.matches("[a-f0-9]{40}")
                  || !name.matches("[\\w.-]+\\.gguf")
                  || !sha.matches("[a-f0-9]{64}")
                  || total <= 0
                  || total > MAX_BYTES)
                throw new IOException("Unverified or unsupported artifact metadata");
              part = new File(directory, validId(id) + ".part");
              initial = part.isFile() ? part.length() : 0;
              if (initial > total) {
                part.delete();
                initial = 0;
              }
              if (initial == total && hash(part).equals(sha)) {
                if (!part.renameTo(file(id))) throw new IOException("Atomic installation failed");
                save(id, m);
                result.complete(m);
                return;
              }
              if (directory.getUsableSpace() < total - initial + 268435456L)
                throw new IOException("Insufficient free storage");
              ConnectivityManager network =
                  (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
              if (network == null) throw new IOException("Network unavailable");
              if (wifiOnly
                  && (Build.VERSION.SDK_INT < 23
                      || network.getActiveNetwork() == null
                      || (network.getNetworkCapabilities(network.getActiveNetwork()) == null
                          || !network
                              .getNetworkCapabilities(network.getActiveNetwork())
                              .hasTransport(NetworkCapabilities.TRANSPORT_WIFI))))
                throw new IOException("Waiting for Wi-Fi; resume when connected");
              URL url = new URL("https://huggingface.co/" + repo + "/resolve/" + rev + "/" + name);
              HttpURLConnection connection = null;
              for (int redirects = 0; redirects <= 8; redirects++) {
                if (stop.get()) throw new IOException("Paused");
                String host = url.getHost();
                if (!AtlasDownloadRules.approved(url))
                  throw new IOException("Unapproved model host");
                connection = (HttpURLConnection) url.openConnection();
                connections.put(id, connection);
                connection.setInstanceFollowRedirects(false);
                connection.setConnectTimeout(20000);
                connection.setReadTimeout(20000);
                if (initial > 0) connection.setRequestProperty("Range", "bytes=" + initial + "-");
                int code = connection.getResponseCode();
                if (code >= 300 && code < 400) {
                  String next = connection.getHeaderField("Location");
                  connection.disconnect();
                  if (next == null || redirects == 8)
                    throw new IOException("Invalid download redirect");
                  url = new URL(url, next);
                  continue;
                }
                if (code != 200 && code != 206)
                  throw new IOException("Model server returned HTTP " + code);
                if (code == 200) initial = 0;
                else if (!AtlasDownloadRules.resumedRange(
                    connection.getHeaderField("Content-Range"), initial, total))
                  throw new IOException("Invalid resumed response");
                break;
              }
              long received = initial, last = 0;
              state(id, "downloading", received, total, start, initial, null);
              try (InputStream in = connection.getInputStream();
                  FileOutputStream out = new FileOutputStream(part, initial > 0)) {
                byte[] buffer = new byte[131072];
                int n;
                while ((n = in.read(buffer)) != -1) {
                  if (stop.get()) throw new IOException("Paused");
                  received += n;
                  if (received > total) throw new IOException("Download exceeded verified size");
                  out.write(buffer, 0, n);
                  long now = SystemClock.elapsedRealtime();
                  if (now - last > 250) {
                    state(id, "downloading", received, total, start, initial, null);
                    last = now;
                  }
                }
                out.getFD().sync();
              }
              if (stop.get()) throw new IOException("Paused");
              if (part.length() != total)
                throw new IOException("Incomplete download; resume to finish");
              state(id, "verifying", total, total, start, initial, null);
              if (!hash(part).equals(sha)) {
                part.delete();
                throw new IOException("SHA-256 mismatch; the corrupted partial file was removed");
              }
              File dest = file(id);
              if (!part.renameTo(dest)) throw new IOException("Atomic installation failed");
              save(id, m);
              verified.remove(id);
              state(id, "installed", total, total, start, initial, null);
              result.complete(m);
            } catch (Exception error) {
              state(
                  id,
                  "paused",
                  part != null && part.isFile() ? part.length() : 0,
                  total,
                  start,
                  initial,
                  stop.get() ? "Paused" : error.getMessage());
              result.completeExceptionally(error);
            } finally {
              HttpURLConnection c = connections.remove(id);
              if (c != null) c.disconnect();
              stops.remove(id);
              jobs.remove(id);
            }
          });
      return result;
    }
  }

  public CompletableFuture<JSONObject> importFile(Uri uri, String name, boolean consent) {
    return CompletableFuture.supplyAsync(
        () -> {
          File part = new File(directory, "import-" + UUID.randomUUID() + ".part");
          try {
            if (!consent) throw new IOException("Import confirmation required");
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            long total = 0;
            try (InputStream in = context.getContentResolver().openInputStream(uri);
                FileOutputStream out = new FileOutputStream(part)) {
              if (in == null) throw new IOException("Could not open chosen file");
              byte[] buffer = new byte[131072];
              int n;
              while ((n = in.read(buffer)) != -1) {
                total += n;
                if (total > MAX_BYTES || directory.getUsableSpace() < n + 67108864L)
                  throw new IOException("Model exceeds storage budget");
                out.write(buffer, 0, n);
                digest.update(buffer, 0, n);
              }
              out.getFD().sync();
            }
            try (InputStream in = new FileInputStream(part)) {
              byte[] magic = new byte[4];
              if (in.read(magic) != 4 || !Arrays.equals(magic, new byte[] {'G', 'G', 'U', 'F'}))
                throw new IOException("The selected file is not GGUF");
            }
            StringBuilder sha = new StringBuilder();
            for (byte b : digest.digest()) sha.append(String.format(Locale.ROOT, "%02x", b));
            String hash = sha.toString(), id = "import-" + hash;
            JSONObject m =
                new JSONObject()
                    .put("id", id)
                    .put("name", name == null ? "Imported GGUF" : name)
                    .put("sha256", hash)
                    .put("bytes", total)
                    .put("integrity", "locally-calculated")
                    .put("downloadable", false)
                    .put("license", "User imported; source/license not independently verified")
                    .put("architecture", "runtime-detected")
                    .put("quantization", "runtime-detected");
            File dest = new File(directory, hash + ".gguf");
            if (dest.isFile()) {
              if (!hash(dest).equals(hash))
                throw new IOException("Existing duplicate failed checksum");
              part.delete();
            } else if (!part.renameTo(dest)) throw new IOException("Atomic import failed");
            save(id, m);
            return m;
          } catch (Exception e) {
            part.delete();
            throw new CompletionException(e);
          }
        },
        transfers);
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
