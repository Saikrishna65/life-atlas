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
@CapacitorPlugin(name="AtlasPermissions",permissions={
 @Permission(alias="audio",strings={Manifest.permission.READ_MEDIA_AUDIO}),
 @Permission(alias="legacyAudio",strings={Manifest.permission.READ_EXTERNAL_STORAGE})
})
public class AtlasPermissionsPlugin extends Plugin {
 private String audioAlias(){return Build.VERSION.SDK_INT>=33?"audio":"legacyAudio";}
 @PluginMethod public void getAudioPermission(PluginCall call){
  PermissionState state=Build.VERSION.SDK_INT<23?PermissionState.GRANTED:getPermissionState(audioAlias());
  call.resolve(new JSObject().put("state",state.toString()).put("granted",state==PermissionState.GRANTED).put("supported",true));
 }
 @PluginMethod public void requestAudioPermission(PluginCall call){
  if(Build.VERSION.SDK_INT<23||getPermissionState(audioAlias())==PermissionState.GRANTED){getAudioPermission(call);return;}
  requestPermissionForAlias(audioAlias(),call,"audioResult");
 }
 @PermissionCallback private void audioResult(PluginCall call){getAudioPermission(call);}
 @PluginMethod public void openAppSettings(PluginCall call){
  try{getActivity().startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,Uri.parse("package:"+getContext().getPackageName())));call.resolve(new JSObject().put("opened",true));}
  catch(Exception error){call.reject("Could not open Android settings",error);}
 }
}
