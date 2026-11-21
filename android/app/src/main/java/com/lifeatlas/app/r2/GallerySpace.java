package com.lifeatlas.app.r2;

import android.content.Context;
import java.io.*;
import java.util.*;
import org.json.*;

/** Manual, recoverable phone cleanup; never accepts a public copy as a private original backup. */
final class GallerySpace {
  static JSONArray verify(Context context, R2Repository repo, JSONArray ids) throws Exception {
    if (ids == null || ids.length() == 0 || ids.length() > 10)
      throw new R2Exception("CLEANUP_SELECTION_LIMIT");
    if (!repo.store.snapshot().optBoolean("recoveryVerified"))
      throw new R2Exception("RECOVERY_VERIFICATION_REQUIRED");
    byte[] keys = repo.keyset();
    R2Credentials credentials = repo.store.credentials("private");
    String scope = R2Duplicates.scope(credentials);
    R2Transport client = new R2Client(credentials);
    JSONArray verified = new JSONArray();
    R2DeviceGallery gallery = new R2DeviceGallery(context);
    try (GallerySearchStore analysis = new GallerySearchStore(repo.store);
        R2LibraryStore library = new R2LibraryStore(repo)) {
      for (JSONObject media : GalleryMediaActions.media(context, ids)) {
        String hash =
            GalleryRecovery.fingerprint(
                context, analysis, media, () -> Thread.currentThread().isInterrupted());
        JSONArray copies = library.fingerprint(R2LibraryStore.token(keys, hash), scope);
        JSONObject chosen = null;
        for (int i = 0; i < copies.length(); i++) {
          JSONObject r = copies.getJSONObject(i);
          if ("private".equals(r.optString("slot"))
              && "active".equals(r.optString("state"))
              && r.optBoolean("verified")
              && hash.equals(r.optString("contentSha256"))
              && R2Crypto.keyId(keys).equals(r.optString("keyId"))) {
            chosen = r;
            break;
          }
        }
        if (chosen == null) throw new R2Exception("VERIFIED_PRIVATE_BACKUP_REQUIRED");
        verifyObject(client, keys, chosen, hash);
        if (!R2DeviceGallery.stamp(media)
            .equals(R2DeviceGallery.stamp(gallery.one(media.getString("id")))))
          throw new R2Exception("SOURCE_CHANGED");
        verified.put(media.getString("id"));
      }
    } finally {
      Arrays.fill(keys, (byte) 0);
    }
    return verified;
  }

  static void verifyObject(R2Transport client, byte[] keys, JSONObject record, String expected)
      throws Exception {
    try (R2Client.Response response =
        client.request("GET", record.getString("key"), Map.of(), Map.of(), null, null)) {
      JSONObject meta =
          R2Envelope.decrypt(
              response.input,
              new OutputStream() {
                public void write(int b) {}

                public void write(byte[] b, int o, int n) {}
              },
              keys,
              record.getString("key"));
      if (!expected.equals(meta.optString("sha256"))
          || meta.optLong("size", -1) != record.optLong("size", -2))
        throw new R2Exception("INTEGRITY_FAILED");
    }
  }
}
