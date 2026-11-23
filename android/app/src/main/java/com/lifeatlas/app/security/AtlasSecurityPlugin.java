package com.lifeatlas.app.security;

import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONObject;

@CapacitorPlugin(name = "AtlasSecurity")
public final class AtlasSecurityPlugin extends Plugin {
  private void guard() throws Exception {
    String url = getBridge().getWebView().getUrl();
    android.net.Uri uri = url == null ? null : android.net.Uri.parse(url);
    if (uri == null || !"https".equals(uri.getScheme()) || !"localhost".equals(uri.getHost()))
      throw new IllegalStateException("BUNDLED_APP_REQUIRED");
  }

  @PluginMethod
  public void getPolicy(PluginCall call) {
    getActivity()
        .runOnUiThread(
            () -> {
              try {
                guard();
                call.resolve(JSObject.fromJSONObject(AtlasSecurity.policy(getContext())));
              } catch (Exception e) {
                call.reject("SECURITY_POLICY_UNAVAILABLE");
              }
            });
  }

  @PluginMethod
  public void setPolicy(PluginCall call) {
    getActivity()
        .runOnUiThread(
            () -> {
              try {
                guard();
                JSONObject next = AtlasSecurity.normalize(call.getObject("policy", new JSObject()));
                boolean verify =
                    AtlasSecurity.any(AtlasSecurity.policy(getContext()))
                        || AtlasSecurity.any(next);
                AtlasSecurity.require(
                    getActivity(),
                    "app",
                    verify,
                    () -> {
                      try {
                        AtlasSecurity.save(getContext(), next);
                        call.resolve(JSObject.fromJSONObject(next));
                      } catch (Exception e) {
                        call.reject("SECURITY_POLICY_UNAVAILABLE");
                      }
                    },
                    code -> call.reject(code));
              } catch (Exception e) {
                call.reject("SECURITY_POLICY_UNAVAILABLE");
              }
            });
  }

  @PluginMethod
  public void authorize(PluginCall call) {
    getActivity()
        .runOnUiThread(
            () -> {
              try {
                guard();
                String scope = call.getString("scope", "");
                if (!AtlasSecurity.SCOPES.contains(scope)) {
                  call.reject("INVALID_SECURITY_SCOPE");
                  return;
                }
                AtlasSecurity.require(
                    getActivity(), scope, false, () -> call.resolve(), code -> call.reject(code));
              } catch (Exception e) {
                call.reject("SECURITY_POLICY_UNAVAILABLE");
              }
            });
  }

  @PluginMethod
  public void lock(PluginCall call) {
    AtlasSecurity.lock();
    call.resolve();
  }

  @PluginMethod
  public void openAssistant(PluginCall call) {
    assistant(call, false);
  }

  @PluginMethod
  public void saveAssistant(PluginCall call) {
    assistant(call, true);
  }

  private void assistant(PluginCall call, boolean save) {
    getActivity()
        .runOnUiThread(
            () -> {
              try {
                guard();
                AtlasSecurity.require(
                    getActivity(),
                    "privateSections",
                    false,
                    () ->
                        execute(
                            () -> {
                              try {
                                AtlasDeviceStore store = new AtlasDeviceStore(getContext());
                                JSONObject result =
                                    save
                                        ? store.save(
                                            call.getObject("data", new JSObject()),
                                            call.getData().optLong("revision", -1L))
                                        : store.read();
                                call.resolve(JSObject.fromJSONObject(result));
                              } catch (Exception e) {
                                call.reject("ASSISTANT_STORAGE_UNAVAILABLE");
                              }
                            }),
                    code -> call.reject(code));
              } catch (Exception e) {
                call.reject("BUNDLED_APP_REQUIRED");
              }
            });
  }

  @Override
  protected void handleOnPause() {
    AtlasSecurity.background();
    super.handleOnPause();
  }

  @Override
  protected void handleOnDestroy() {
    AtlasSecurity.lock();
    super.handleOnDestroy();
  }
}
