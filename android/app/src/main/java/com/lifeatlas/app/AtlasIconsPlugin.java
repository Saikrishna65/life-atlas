package com.lifeatlas.app;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AtlasIcons")
public class AtlasIconsPlugin extends Plugin {
    private interface Operation { JSObject run(AtlasIconStore store) throws Exception; }
    private void perform(PluginCall call, Operation action) {
        execute(() -> {
            try { call.resolve(action.run(new AtlasIconStore(getContext()))); }
            catch (IllegalArgumentException error) { call.reject(error.getMessage()); }
            catch (Exception error) { call.reject("The icon could not be updated. Try again while Atlas is open."); }
        });
    }
    @PluginMethod public void getSettings(PluginCall call) {
        perform(call, store -> {
            JSArray apps = new JSArray();
            for (String module : AtlasIconPolicy.MODULES) apps.put(store.summary(module, false));
            return new JSObject().put("apps", apps).put("supported", store.supported());
        });
    }
    @PluginMethod public void getIcon(PluginCall call) { perform(call, store -> store.summary(call.getString("module", ""), true)); }
    @PluginMethod public void saveIcon(PluginCall call) { perform(call, store -> store.save(call.getString("module", ""), call.getString("label"), call.getString("pngBase64"), call.getObject("design"))); }
    @PluginMethod public void pinIcon(PluginCall call) { perform(call, store -> store.pin(call.getString("module", ""))); }
    @PluginMethod public void resetIcon(PluginCall call) { perform(call, store -> store.reset(call.getString("module", ""))); }
}
