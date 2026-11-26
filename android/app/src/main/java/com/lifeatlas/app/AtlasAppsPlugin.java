package com.lifeatlas.app;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.*;
import java.net.*;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import org.json.*;

/** Companion installation only. No access to gallery, vaults or assistant data. */
@CapacitorPlugin(name = "AtlasApps")
public class AtlasAppsPlugin extends Plugin {
  private final ExecutorService worker = Executors.newSingleThreadExecutor();
  private final AtomicBoolean busy = new AtomicBoolean();
  private final AtomicBoolean canceled = new AtomicBoolean();
  private volatile HttpURLConnection connection;
  private volatile String phase = "idle", error = "";
  private volatile long received;
  private volatile JSONObject available;
  private volatile boolean ready;

  private SharedPreferences prefs() {
    return getContext().getSharedPreferences("atlas-companion-video", Context.MODE_PRIVATE);
  }

  private File directory() throws IOException {
    File dir = new File(getContext().getCacheDir(), "atlas-companion-video");
    if (!dir.isDirectory() && !dir.mkdirs()) throw new IOException("Update storage unavailable.");
    return dir;
  }

  private File apk() throws IOException {
    return new File(directory(), "video.apk");
  }

  private PackageInfo installed() throws Exception {
    try {
      return getContext()
          .getPackageManager()
          .getPackageInfo(AtlasCompanionPolicy.PACKAGE, signatureFlags());
    } catch (PackageManager.NameNotFoundException absent) {
      return null;
    }
  }

  private int signatureFlags() {
    return Build.VERSION.SDK_INT >= 28
        ? PackageManager.GET_SIGNING_CERTIFICATES
        : PackageManager.GET_SIGNATURES;
  }

  private long code(PackageInfo info) {
    return info == null
        ? 0
        : Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode;
  }

  private boolean allowedInstall() {
    return Build.VERSION.SDK_INT < 26
        || getContext().getPackageManager().canRequestPackageInstalls();
  }

  private JSObject status() throws Exception {
    PackageInfo current = installed();
    return new JSObject()
        .put("installed", current != null)
        .put("installedVersion", current == null ? "" : current.versionName)
        .put("installedCode", code(current))
        .put("packageId", AtlasCompanionPolicy.PACKAGE)
        .put("phase", phase)
        .put("error", error)
        .put("downloadedBytes", received)
        .put("release", available == null ? JSONObject.NULL : new JSObject(available.toString()))
        .put("ready", ready)
        .put("canInstall", allowedInstall())
        .put("wifiOnly", prefs().getBoolean("wifi", true));
  }

  private boolean restored;

  private synchronized void restore() {
    if (restored) return;
    restored = true;
    try {
      String cached = prefs().getString("candidate", "");
      if (!cached.isEmpty()) {
        JSONObject entry = new JSONObject(cached);
        available =
            AtlasCompanionPolicy.candidate(
                new JSONObject()
                    .put("schemaVersion", 1)
                    .put("notes", entry.optString("notes"))
                    .put("packages", new JSONArray().put(entry)));
      }
    } catch (Exception ignored) {
      available = null;
    }
  }

  private interface Operation {
    void run() throws Exception;
  }

  private void run(PluginCall call, Operation op) {
    restore();
    if (!busy.compareAndSet(false, true)) {
      call.reject("An app download or check is already running.", "UPDATE_BUSY");
      return;
    }
    canceled.set(false);
    worker.execute(
        () -> {
          try {
            error = "";
            op.run();
            call.resolve(status());
          } catch (Exception e) {
            if (canceled.get()) {
              phase = "idle";
              error = "Download canceled. You can retry later.";
            } else {
              phase = "error";
              error =
                  e instanceof UpdateFailure
                      ? e.getMessage()
                      : "Atlas Video is unavailable. Check your connection and try again.";
            }
            try {
              call.resolve(status());
            } catch (Exception ignored) {
              call.reject("App release unavailable.");
            }
          } finally {
            connection = null;
            busy.set(false);
          }
        });
  }

  private static class UpdateFailure extends IOException {
    UpdateFailure(String message) {
      super(message);
    }
  }

  private HttpURLConnection open(String address) throws Exception {
    for (int redirects = 0; redirects < 6; redirects++) {
      if (!AtlasUpdatePolicy.trustedUrl(address))
        throw new UpdateFailure("The update address is not trusted.");
      HttpURLConnection c = (HttpURLConnection) new URL(address).openConnection();
      connection = c;
      c.setInstanceFollowRedirects(false);
      c.setConnectTimeout(15000);
      c.setReadTimeout(20000);
      c.setRequestProperty("User-Agent", "Atlas-Companion-Installer");
      c.setRequestProperty("Accept", "application/vnd.github+json, application/octet-stream");
      c.setRequestProperty("Cache-Control", "no-cache");
      int response = c.getResponseCode();
      if (response >= 300 && response <= 399) {
        String location = c.getHeaderField("Location");
        c.disconnect();
        if (location == null) break;
        address = new URL(new URL(address), location).toString();
        continue;
      }
      if (response != 200) {
        c.disconnect();
        throw new UpdateFailure(
            response == 403 || response == 429
                ? "Update checks are temporarily rate limited. Try later."
                : "The update could not be downloaded. Try again later.");
      }
      return c;
    }
    throw new UpdateFailure("The update address could not be verified.");
  }

  private String json(String url, int limit) throws Exception {
    HttpURLConnection c = open(url);
    try (InputStream in = c.getInputStream();
        ByteArrayOutputStream out = new ByteArrayOutputStream()) {
      byte[] bytes = new byte[8192];
      int n;
      while ((n = in.read(bytes)) != -1) {
        if (out.size() + n > limit) throw new UpdateFailure("Update catalog too large.");
        out.write(bytes, 0, n);
      }
      return out.toString("UTF-8");
    } finally {
      c.disconnect();
    }
  }

  @PluginMethod
  public void getStatus(PluginCall call) {
    restore();
    try {
      call.resolve(status());
    } catch (Exception e) {
      call.reject("App information unavailable.");
    }
  }

  @PluginMethod
  public void configure(PluginCall call) {
    SharedPreferences.Editor edit = prefs().edit();
    if (call.hasOption("wifiOnly"))
      edit.putBoolean("wifi", Boolean.TRUE.equals(call.getBoolean("wifiOnly")));
    edit.apply();
    getStatus(call);
  }

  @PluginMethod
  public void check(PluginCall call) {
    run(
        call,
        () -> {
          phase = "checking";
          JSONArray releases = new JSONArray(json(AtlasCompanionPolicy.FEED, 2 * 1024 * 1024));
          JSONObject best = null;
          for (int i = 0; i < Math.min(50, releases.length()); i++) {
            JSONObject release = releases.getJSONObject(i);
            if (release.optBoolean("draft")
                || release.optBoolean("prerelease")
                || !release.optString("tag_name").startsWith(AtlasCompanionPolicy.TAG)) continue;
            JSONArray assets = release.optJSONArray("assets");
            if (assets == null) continue;
            for (int j = 0; j < assets.length(); j++) {
              JSONObject asset = assets.getJSONObject(j);
              String url = asset.optString("browser_download_url");
              if (!AtlasCompanionPolicy.MANIFEST.equals(asset.optString("name"))
                  || !AtlasUpdatePolicy.releaseAsset(url)) continue;
              JSONObject entry = AtlasCompanionPolicy.candidate(new JSONObject(json(url, 65536)));
              if (entry != null
                  && (best == null || entry.getLong("versionCode") > best.optLong("versionCode")))
                best = entry;
            }
          }
          if (available == null
              || best == null
              || !available.optString("sha256").equals(best.optString("sha256"))) ready = false;
          available = best;
          prefs()
              .edit()
              .putLong("checked", System.currentTimeMillis())
              .putString("candidate", best == null ? "" : best.toString())
              .apply();
          phase = ready ? "ready" : "idle";
        });
  }

  private void network() throws Exception {
    ConnectivityManager cm =
        (ConnectivityManager) getContext().getSystemService(Context.CONNECTIVITY_SERVICE);
    if (Build.VERSION.SDK_INT >= 23) {
      NetworkCapabilities caps = cm.getNetworkCapabilities(cm.getActiveNetwork());
      if (caps == null || !caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET))
        throw new UpdateFailure("You’re offline. Your app still works; download the update later.");
      if (prefs().getBoolean("wifi", true)
          && !caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI))
        throw new UpdateFailure("Connect to Wi-Fi, or turn off Wi-Fi-only downloads.");
    } else if (prefs().getBoolean("wifi", true) && cm.isActiveNetworkMetered())
      throw new UpdateFailure("Use an unmetered connection for this download.");
  }

  @PluginMethod
  public void download(PluginCall call) {
    run(
        call,
        () -> {
          if (!Boolean.TRUE.equals(call.getBoolean("consent")))
            throw new UpdateFailure("Approve downloading Atlas Video first.");
          if (available == null) throw new UpdateFailure("Check for an Atlas Video release first.");
          if (available.getLong("versionCode") <= code(installed()))
            throw new UpdateFailure("This version is already installed. Open Atlas Video instead.");
          canceled.set(false);
          JSONObject entry = new JSONObject(available.toString());
          if (apk().isFile()) {
            try {
              verify(apk(), entry);
              ready = true;
              phase = "ready";
              return;
            } catch (Exception ignored) {
              apk().delete();
            }
          }
          network();
          if (directory().getUsableSpace() < entry.getLong("bytes") * 2 + 32 * 1024 * 1024)
            throw new UpdateFailure("Free some phone storage before downloading this app.");
          ready = false;
          received = 0;
          phase = "downloading";
          File part = new File(directory(), "atlas.part");
          apk().delete();
          HttpURLConnection c = null;
          try {
            c = open(entry.getString("url"));
            try (InputStream in = c.getInputStream();
                FileOutputStream out = new FileOutputStream(part)) {
              byte[] bytes = new byte[65536];
              int n;
              while ((n = in.read(bytes)) != -1) {
                if (canceled.get()) throw new IOException("Canceled");
                received += n;
                if (received > entry.getLong("bytes"))
                  throw new UpdateFailure("The update size did not match. Download again.");
                out.write(bytes, 0, n);
              }
              out.getFD().sync();
            }
            phase = "verifying";
            verify(part, entry);
            if (canceled.get()) throw new IOException("Canceled");
            if (!part.renameTo(apk()))
              throw new UpdateFailure(
                  "The verified update could not be saved. Retry the download.");
            ready = true;
            phase = "ready";
          } finally {
            if (c != null) c.disconnect();
            part.delete();
          }
        });
  }

  private String hex(byte[] data) {
    StringBuilder out = new StringBuilder();
    for (byte b : data) out.append(String.format(Locale.ROOT, "%02x", b & 255));
    return out.toString();
  }

  private Set<String> signers(PackageInfo info) throws Exception {
    Signature[] signatures =
        Build.VERSION.SDK_INT >= 28
            ? (info.signingInfo == null ? null : info.signingInfo.getApkContentsSigners())
            : info.signatures;
    if (signatures == null || signatures.length == 0)
      throw new UpdateFailure("The APK signature could not be verified.");
    Set<String> values = new HashSet<>();
    for (Signature s : signatures)
      values.add(hex(MessageDigest.getInstance("SHA-256").digest(s.toByteArray())));
    return values;
  }

  void verify(File file, JSONObject entry) throws Exception {
    if (file.length() != entry.getLong("bytes"))
      throw new UpdateFailure("The download is incomplete. Retry it.");
    MessageDigest digest = MessageDigest.getInstance("SHA-256");
    try (InputStream in = new FileInputStream(file)) {
      byte[] bytes = new byte[65536];
      int n;
      while ((n = in.read(bytes)) != -1) digest.update(bytes, 0, n);
    }
    if (!hex(digest.digest()).equals(entry.getString("sha256")))
      throw new UpdateFailure("Update integrity check failed. Download it again.");
    PackageInfo
        archive =
            getContext()
                .getPackageManager()
                .getPackageArchiveInfo(file.getAbsolutePath(), signatureFlags()),
        current = installed();
    if (archive != null
        && Build.VERSION.SDK_INT >= 24
        && archive.applicationInfo != null
        && archive.applicationInfo.minSdkVersion > Build.VERSION.SDK_INT)
      throw new UpdateFailure("Atlas Video requires a newer Android version.");
    if (archive == null
        || !AtlasCompanionPolicy.PACKAGE.equals(archive.packageName)
        || code(archive) != entry.getLong("versionCode")
        || code(archive) <= code(current)
        || !signers(archive).equals(Collections.singleton(AtlasCompanionPolicy.SIGNER))
        || current != null && !signers(archive).equals(signers(current)))
      throw new UpdateFailure(
          "This APK is not a trusted Atlas Video release or cannot update your installed version."
              + " Nothing was installed.");
  }

  @PluginMethod
  public void cancel(PluginCall call) {
    canceled.set(true);
    HttpURLConnection c = connection;
    if (c != null) c.disconnect();
    call.resolve();
  }

  @PluginMethod
  public void install(PluginCall call) {
    run(
        call,
        () -> {
          if (!Boolean.TRUE.equals(call.getBoolean("consent")))
            throw new UpdateFailure("Approve installing Atlas Video first.");
          if (!ready || available == null)
            throw new UpdateFailure("Download and verify Atlas Video first.");
          try {
            verify(apk(), available);
          } catch (Exception e) {
            ready = false;
            apk().delete();
            throw e;
          }
          getActivity()
              .runOnUiThread(
                  () -> {
                    try {
                      if (!allowedInstall()) {
                        getActivity()
                            .startActivity(
                                new Intent(
                                    Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                                    Uri.parse("package:" + getContext().getPackageName())));
                      } else {
                        Uri uri =
                            FileProvider.getUriForFile(
                                getContext(),
                                getContext().getPackageName() + ".fileprovider",
                                apk());
                        getActivity()
                            .startActivity(
                                new Intent(Intent.ACTION_VIEW)
                                    .setDataAndType(uri, "application/vnd.android.package-archive")
                                    .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION));
                      }
                    } catch (Exception e) {
                      error = "Android could not open the installer. Try again from Atlas Apps.";
                      phase = "error";
                    }
                  });
        });
  }

  @PluginMethod
  public void openApp(PluginCall call) {
    getActivity()
        .runOnUiThread(
            () -> {
              try {
                Intent launch =
                    getContext()
                        .getPackageManager()
                        .getLaunchIntentForPackage(AtlasCompanionPolicy.PACKAGE);
                if (launch == null) {
                  call.reject("Install Atlas Video first.");
                  return;
                }
                getActivity().startActivity(launch);
                call.resolve();
              } catch (Exception e) {
                call.reject("Android could not open Atlas Video.");
              }
            });
  }

  @Override
  protected void handleOnDestroy() {
    canceled.set(true);
    HttpURLConnection c = connection;
    if (c != null) c.disconnect();
    worker.shutdownNow();
    super.handleOnDestroy();
  }
}
