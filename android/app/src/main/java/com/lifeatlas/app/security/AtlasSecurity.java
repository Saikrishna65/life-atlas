package com.lifeatlas.app.security;

import android.app.Activity;
import android.content.Context;
import android.os.Build;
import android.util.AtomicFile;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;
import java.io.*;
import java.util.*;
import java.util.function.Consumer;
import org.json.JSONObject;

/** Device-local opt-in authentication. No passwords, default PINs, or timed upload approvals. */
public final class AtlasSecurity {
  public static final List<String> SCOPES =
      List.of(
          "app",
          "gallery",
          "privateSections",
          "cloudCredentials",
          "publishing",
          "deletion",
          "backups",
          "aiActions");
  private static final Object LOCK = new Object();
  private static boolean verified;
  private static boolean prompting;
  private static final List<Runnable> grants = new ArrayList<>();
  private static final List<Consumer<String>> failures = new ArrayList<>();

  private static File file(Context c) {
    return new File(c.getNoBackupFilesDir(), "atlas-security-policy.json");
  }

  public static byte[] readLimited(InputStream in, int limit) throws IOException {
    ByteArrayOutputStream out = new ByteArrayOutputStream();
    byte[] buffer = new byte[16384];
    int count;
    while ((count = in.read(buffer)) != -1) {
      if (out.size() + count > limit) throw new IOException("FILE_TOO_LARGE");
      out.write(buffer, 0, count);
    }
    Arrays.fill(buffer, (byte) 0);
    return out.toByteArray();
  }

  public static JSONObject normalize(JSONObject input) throws Exception {
    JSONObject out = new JSONObject();
    for (String scope : SCOPES) {
      Object value = input.opt(scope);
      if (value != null && !(value instanceof Boolean))
        throw new IOException("INVALID_SECURITY_POLICY");
      out.put(scope, Boolean.TRUE.equals(value));
    }
    for (Iterator<String> i = input.keys(); i.hasNext(); )
      if (!SCOPES.contains(i.next())) throw new IOException("INVALID_SECURITY_POLICY");
    return out;
  }

  public static JSONObject policy(Context c) throws Exception {
    synchronized (LOCK) {
      AtomicFile store = new AtomicFile(file(c));
      if (!store.getBaseFile().exists() && !new File(file(c) + ".bak").exists())
        return normalize(new JSONObject());
      try (InputStream in = store.openRead()) {
        byte[] data = readLimited(in, 8192);
        if (data.length > 8192) throw new IOException("SECURITY_POLICY_UNAVAILABLE");
        return normalize(new JSONObject(new String(data, java.nio.charset.StandardCharsets.UTF_8)));
      }
    }
  }

  public static void save(Context c, JSONObject value) throws Exception {
    synchronized (LOCK) {
      byte[] data = normalize(value).toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
      AtomicFile store = new AtomicFile(file(c));
      FileOutputStream out = null;
      try {
        out = store.startWrite();
        out.write(data);
        store.finishWrite(out);
      } catch (Exception e) {
        if (out != null) store.failWrite(out);
        throw e;
      }
    }
  }

  public static boolean any(JSONObject policy) {
    for (String scope : SCOPES) if (policy.optBoolean(scope)) return true;
    return false;
  }

  public static boolean required(Context c, String scope) throws Exception {
    if (!SCOPES.contains(scope)) throw new IOException("INVALID_SECURITY_SCOPE");
    JSONObject value = policy(c);
    return value.getBoolean("app") || value.getBoolean(scope);
  }

  public static boolean allowedWithoutPrompt(Context context, String scope) {
    synchronized (LOCK) {
      try {
        return verified || !required(context, scope);
      } catch (Exception error) {
        return false;
      }
    }
  }

  public static void background() {
    synchronized (LOCK) {
      if (!prompting) verified = false;
    }
  }

  public static void lock() {
    synchronized (LOCK) {
      verified = false;
    }
  }

  public static void require(
      Activity activity, String scope, boolean force, Runnable granted, Consumer<String> failed) {
    activity.runOnUiThread(
        () -> {
          try {
            synchronized (LOCK) {
              if (verified || (!force && !required(activity, scope))) {
                granted.run();
                return;
              }
              grants.add(granted);
              failures.add(failed);
              if (prompting) return;
              prompting = true;
            }
            int allowed =
                (Build.VERSION.SDK_INT >= 30
                        ? BiometricManager.Authenticators.BIOMETRIC_STRONG
                        : BiometricManager.Authenticators.BIOMETRIC_WEAK)
                    | BiometricManager.Authenticators.DEVICE_CREDENTIAL;
            if (!(activity instanceof FragmentActivity)
                || BiometricManager.from(activity).canAuthenticate(allowed)
                    != BiometricManager.BIOMETRIC_SUCCESS) {
              finish(false, "DEVICE_LOCK_REQUIRED");
              return;
            }
            BiometricPrompt prompt =
                new BiometricPrompt(
                    (FragmentActivity) activity,
                    ContextCompat.getMainExecutor(activity),
                    new BiometricPrompt.AuthenticationCallback() {
                      @Override
                      public void onAuthenticationSucceeded(
                          BiometricPrompt.AuthenticationResult result) {
                        finish(true, "");
                      }

                      @Override
                      public void onAuthenticationError(int code, CharSequence text) {
                        finish(false, "AUTHENTICATION_CANCELLED");
                      }
                    });
            prompt.authenticate(
                new BiometricPrompt.PromptInfo.Builder()
                    .setTitle("Atlas")
                    .setSubtitle("Verify using your phone’s fingerprint or device PIN")
                    .setAllowedAuthenticators(allowed)
                    .build());
          } catch (Exception error) {
            if (prompting) finish(false, "SECURITY_POLICY_UNAVAILABLE");
            else failed.accept("SECURITY_POLICY_UNAVAILABLE");
          }
        });
  }

  private static void finish(boolean success, String code) {
    List<Runnable> ok;
    List<Consumer<String>> no;
    synchronized (LOCK) {
      verified = success;
      prompting = false;
      ok = new ArrayList<>(grants);
      no = new ArrayList<>(failures);
      grants.clear();
      failures.clear();
    }
    if (success) for (Runnable callback : ok) callback.run();
    else for (Consumer<String> callback : no) callback.accept(code);
  }

  public static String storageScope(String method, String slot) {
    switch (method) {
      case "saveConfiguration":
      case "disconnectBucket":
      case "testConnection":
      case "resetUnavailableKeystore":
        return "cloudCredentials";
      case "deleteObject":
      case "deleteObjects":
      case "freeUpDeviceMedia":
      case "changeLibraryTrash":
      case "trashDeviceMedia":
        return "deletion";
      case "beginTripPublication":
      case "publishMedia":
      case "publishTripMedia":
      case "unpublishMedia":
      case "createPublicCopy":
        return "publishing";
      case "uploadObject":
      case "startMultipartUpload":
      case "uploadMultipartPart":
      case "completeMultipartUpload":
        return "private".equals(slot) ? "backups" : "publishing";
      case "beginLibrarySession":
      case "openGalleryCloudPreview":
        return "gallery";
      case "getObjectPreview":
        return "privateSections";
      default:
        return "backups";
    }
  }
}
