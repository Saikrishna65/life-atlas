package com.lifeatlas.app;

import android.Manifest;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "AtlasPermissions",
    permissions = {
      @Permission(
          alias = "audio",
          strings = {Manifest.permission.READ_MEDIA_AUDIO}),
      @Permission(
          alias = "legacyAudio",
          strings = {Manifest.permission.READ_EXTERNAL_STORAGE}),
      @Permission(
          alias = "location",
          strings = {
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION
          })
    })
public class AtlasPermissionsPlugin extends Plugin {
  @PluginMethod
  public void pinGalleryShortcut(PluginCall call) {
    pinShortcut(call, "gallery");
  }

  @PluginMethod
  public void pinModuleShortcut(PluginCall call) {
    pinShortcut(call, call.getString("module", ""));
  }

  private void pinShortcut(PluginCall call, String module) {
    String component, label;
    int icon;
    switch (module) {
      case "finance": component = "FinanceLauncher"; label = "Atlas Finance"; icon = R.drawable.ic_atlas_finance; break;
      case "music": component = "MusicLauncher"; label = "Atlas Music"; icon = R.drawable.ic_atlas_music; break;
      case "gallery": component = "GalleryLauncher"; label = "Atlas Gallery"; icon = R.drawable.ic_atlas_photos; break;
      default: call.reject("Unknown Atlas app"); return;
    }
    if (Build.VERSION.SDK_INT < 26) {
      call.resolve(new JSObject().put("supported", false).put("requested", false));
      return;
    }
    android.content.pm.ShortcutManager manager =
        getContext().getSystemService(android.content.pm.ShortcutManager.class);
    boolean supported = manager != null && manager.isRequestPinShortcutSupported();
    boolean requested = false;
    if (supported) {
      Intent intent =
          new Intent(Intent.ACTION_MAIN)
              .setComponent(
                  new android.content.ComponentName(
                      getContext(), "com.lifeatlas.app." + component))
              .addCategory(Intent.CATEGORY_LAUNCHER);
      android.content.pm.ShortcutInfo shortcut =
          new android.content.pm.ShortcutInfo.Builder(getContext(), "atlas-" + module)
              .setShortLabel(label)
              .setLongLabel(label)
              .setIcon(
                  android.graphics.drawable.Icon.createWithResource(
                      getContext(), icon))
              .setIntent(intent)
              .build();
      requested = manager.requestPinShortcut(shortcut, null);
    }
    call.resolve(new JSObject().put("supported", supported).put("requested", requested));
  }

  private String audioAlias() {
    return Build.VERSION.SDK_INT >= 33 ? "audio" : "legacyAudio";
  }

  @PluginMethod
  public void getAudioPermission(PluginCall call) {
    PermissionState state =
        Build.VERSION.SDK_INT < 23 ? PermissionState.GRANTED : getPermissionState(audioAlias());
    call.resolve(
        new JSObject()
            .put("state", state.toString())
            .put("granted", state == PermissionState.GRANTED)
            .put("supported", true));
  }

  @PluginMethod
  public void requestAudioPermission(PluginCall call) {
    if (Build.VERSION.SDK_INT < 23 || getPermissionState(audioAlias()) == PermissionState.GRANTED) {
      getAudioPermission(call);
      return;
    }
    requestPermissionForAlias(audioAlias(), call, "audioResult");
  }

  @PermissionCallback
  private void audioResult(PluginCall call) {
    getAudioPermission(call);
  }

  @PluginMethod
  public void getLocationPermission(PluginCall call) {
    PermissionState state =
        Build.VERSION.SDK_INT < 23 ? PermissionState.GRANTED : getPermissionState("location");
    call.resolve(
        new JSObject()
            .put("state", state.toString())
            .put("granted", state == PermissionState.GRANTED)
            .put("supported", true));
  }

  @PluginMethod
  public void requestLocationPermission(PluginCall call) {
    if (Build.VERSION.SDK_INT < 23 || getPermissionState("location") == PermissionState.GRANTED) {
      getLocationPermission(call);
      return;
    }
    requestPermissionForAlias("location", call, "locationResult");
  }

  @PermissionCallback
  private void locationResult(PluginCall call) {
    getLocationPermission(call);
  }

  @PluginMethod
  public void openAppSettings(PluginCall call) {
    try {
      getActivity()
          .startActivity(
              new Intent(
                  Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                  Uri.parse("package:" + getContext().getPackageName())));
      call.resolve(new JSObject().put("opened", true));
    } catch (Exception error) {
      call.reject("Could not open Android settings", error);
    }
  }
}
