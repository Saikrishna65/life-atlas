package com.lifeatlas.app.r2;

import android.content.Context;
import android.database.Cursor;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import org.json.*;

/** Private, immutable recovery sidecars. Originals and public catalogs are never written. */
final class GalleryRecovery {
  static final int LIMIT = 16 * 1024 * 1024;
  static final List<String> CHOICES =
      List.of(
          "people", "similar", "memories", "media-preferences", "albums", "edits", "viewer-state");

  static String prefix(byte[] keys) {
    return "encrypted/catalog/gallery-ai/" + R2Crypto.keyId(keys) + "/";
  }

  static JSONObject status(GalleryIntelligence service) throws Exception {
    try (GallerySearchStore db = new GallerySearchStore(service.secure)) {
      return db.choice("recovery-settings");
    }
  }

  static void progress(GalleryIntelligence service, String state, int done, int total, String error)
      throws Exception {
    synchronized (GalleryIntelligence.STATE_LOCK) {
      try (GallerySearchStore db = new GallerySearchStore(service.secure)) {
        JSONObject v = db.choice("recovery-settings");
        v.put("state", state).put("processed", done).put("total", total).put("error", error);
        db.choice("recovery-settings", v);
      }
    }
  }

  static void clearStaged(GallerySearchStore db) throws Exception {
    JSONObject staged = db.choice("recovery-staged");
    JSONArray refs = staged.optJSONArray("photos");
    if (refs != null)
      for (int i = 0; i < refs.length(); i++)
        db.forgetChoices("restore-photo:" + refs.getJSONObject(i).getString("hash"));
    db.forgetChoices("recovery-staged");
  }

  static void forgetPendingPeople(GallerySearchStore db) throws Exception {
    JSONObject state = db.choice("recovery-settings");
    state.put("denyRecoveredFaces", true);
    db.choice("recovery-settings", state);
    JSONObject staged = db.choice("recovery-staged");
    if (staged.length() == 0) return;
    staged.put("restoreFaces", false);
    staged.getJSONObject("choices").remove("people");
    staged.put("faceMap", new JSONObject());
    JSONArray refs = staged.getJSONArray("photos");
    for (int i = 0; i < refs.length(); i++) {
      String key = "restore-photo:" + refs.getJSONObject(i).getString("hash");
      JSONObject record = db.choice(key);
      JSONObject row = record.optJSONObject("row");
      if (row != null) {
        row.remove("faces");
        row.remove("faceVersion");
        db.choice(key, record);
      }
    }
    db.choice("recovery-staged", staged);
  }

  static JSONObject configure(Context context, boolean enabled) throws Exception {
    R2Repository repo = new R2Repository(context);
    GalleryIntelligence service = new GalleryIntelligence(context);
    if (enabled) {
      repo.store.credentials("private");
      if (!repo.store.snapshot().optBoolean("recoveryVerified"))
        throw new R2Exception("RECOVERY_VERIFICATION_REQUIRED");
    }
    try (GallerySearchStore db = new GallerySearchStore(service.secure)) {
      JSONObject v = db.choice("recovery-settings");
      v.put("enabled", enabled).put("state", enabled ? "waiting" : "off");
      if (enabled) v.put("approvedScope", R2Duplicates.scope(repo.store.credentials("private")));
      db.choice("recovery-settings", v);
    }
    if (enabled) GalleryRecoveryWorker.schedule(context, "backup", false);
    else
      androidx.work.WorkManager.getInstance(context).cancelUniqueWork(GalleryRecoveryWorker.WORK);
    return status(service);
  }

  static byte[] encode(JSONObject value, byte[] keys, String key) throws Exception {
    byte[] plain = value.toString().getBytes(StandardCharsets.UTF_8);
    if (plain.length > LIMIT) throw new R2Exception("GALLERY_RECOVERY_LIMIT");
    ByteArrayOutputStream out = new ByteArrayOutputStream();
    try {
      R2Envelope.encrypt(
          new ByteArrayInputStream(plain),
          out,
          keys,
          key,
          new JSONObject()
              .put("name", "gallery-analysis.json")
              .put("mimeType", "application/vnd.life-atlas.gallery+json")
              .put("size", plain.length)
              .put("sha256", R2Policy.digest(plain)));
      return out.toByteArray();
    } finally {
      Arrays.fill(plain, (byte) 0);
    }
  }

  static JSONObject decode(byte[] cipher, byte[] keys, String key) throws Exception {
    if (cipher.length > LIMIT + 65536) throw new R2Exception("GALLERY_RECOVERY_LIMIT");
    ByteArrayOutputStream out = new ByteArrayOutputStream();
    R2Envelope.decrypt(
        new ByteArrayInputStream(cipher),
        new OutputStream() {
          public void write(int b) throws IOException {
            if (out.size() >= LIMIT) throw new IOException("limit");
            out.write(b);
          }

          public void write(byte[] b, int offset, int length) throws IOException {
            if (out.size() + length > LIMIT) throw new IOException("limit");
            out.write(b, offset, length);
          }
        },
        keys,
        key);
    byte[] plain = out.toByteArray();
    try {
      return new JSONObject(new String(plain, StandardCharsets.UTF_8));
    } finally {
      Arrays.fill(plain, (byte) 0);
    }
  }

  static JSONObject get(R2Transport client, byte[] keys, String key) throws Exception {
    if (!key.startsWith(prefix(keys)) || !key.endsWith(".atlas"))
      throw new R2Exception("INVALID_GALLERY_RECOVERY");
    try (R2Client.Response r = client.request("GET", key, Map.of(), Map.of(), null, null)) {
      return decode(r.read(LIMIT + 65536), keys, key);
    }
  }

  static void put(R2Transport client, byte[] keys, String key, JSONObject value) throws Exception {
    byte[] cipher = encode(value, keys, key);
    try (R2Client.Response r =
        client.request(
            "PUT",
            key,
            Map.of(),
            Map.of(
                "if-none-match",
                "*",
                "content-type",
                "application/octet-stream",
                "cache-control",
                "private, no-store",
                "x-amz-meta-sha256",
                R2Policy.digest(cipher)),
            R2Client.bytes(cipher),
            null)) {}
    // Only publish references after verifying the authenticated uploaded payload.
    JSONObject verified = get(client, keys, key);
    if (!R2Policy.digest(verified.toString().getBytes(StandardCharsets.UTF_8))
        .equals(R2Policy.digest(value.toString().getBytes(StandardCharsets.UTF_8))))
      throw new R2Exception("INTEGRITY_FAILED");
  }

  static String fingerprint(
      Context context,
      GallerySearchStore db,
      JSONObject media,
      java.util.function.BooleanSupplier stopped)
      throws Exception {
    String id = media.getString("id"),
        stamp = R2DeviceGallery.stamp(media),
        key = "file-hash:" + id;
    JSONObject saved = db.choice(key);
    if (stamp.equals(saved.optString("stamp")) && saved.optString("hash").matches("[a-f0-9]{64}"))
      return saved.getString("hash");
    MessageDigest digest = MessageDigest.getInstance("SHA-256");
    byte[] buffer = new byte[65536];
    try (InputStream in =
        context.getContentResolver().openInputStream(R2DeviceGallery.originalUri(id))) {
      if (in == null) throw new R2Exception("SOURCE_UNAVAILABLE");
      int n;
      while ((n = in.read(buffer)) != -1) {
        if (stopped.getAsBoolean()) throw new InterruptedIOException();
        digest.update(buffer, 0, n);
      }
    } finally {
      Arrays.fill(buffer, (byte) 0);
    }
    JSONObject current = new R2DeviceGallery(context).one(id);
    if (!stamp.equals(R2DeviceGallery.stamp(current))) throw new R2Exception("SOURCE_CHANGED");
    String hash = R2Policy.hex(digest.digest());
    db.choice(key, new JSONObject().put("stamp", stamp).put("hash", hash));
    return hash;
  }

  static void backup(Context context, java.util.function.BooleanSupplier stopped) throws Exception {
    R2Repository repo = new R2Repository(context);
    GalleryIntelligence service = new GalleryIntelligence(context);
    if (!status(service).optBoolean("enabled")) return;
    if (!repo.store.snapshot().optBoolean("recoveryVerified"))
      throw new R2Exception("RECOVERY_VERIFICATION_REQUIRED");
    R2Credentials credentials = repo.store.credentials("private");
    String scope = R2Duplicates.scope(credentials);
    if (!scope.equals(status(service).optString("approvedScope")))
      throw new R2Exception("CONFIGURATION_CHANGED");
    R2Transport client = new R2Client(credentials);
    byte[] keys = repo.keyset();
    try (GallerySearchStore db = new GallerySearchStore(service.secure)) {
      JSONArray refs = new JSONArray();
      int done = 0, total = db.count();
      long revision = db.revision();
      if (total == 0) {
        progress(service, "empty", 0, 0, "");
        JSONObject state = db.choice("recovery-settings");
        state.put("savedRevision", revision);
        db.choice("recovery-settings", state);
        return;
      }
      JSONObject choices = new JSONObject();
      synchronized (GalleryIntelligence.STATE_LOCK) {
        for (String name : CHOICES)
          choices.put(name, name.equals("albums") ? GalleryAlbums.export(db) : db.choice(name));
      }
      try (Cursor rows = db.rows()) {
        while (rows.moveToNext()) {
          if (stopped.getAsBoolean() || !status(service).optBoolean("enabled"))
            throw new InterruptedIOException();
          if (!scope.equals(R2Duplicates.scope(repo.store.credentials("private"))))
            throw new R2Exception("CONFIGURATION_CHANGED");
          JSONObject row = db.read(rows.getString(0), rows.getBlob(1)),
              media = row.getJSONObject("media");
          String id = media.getString("id"), stamp = row.optString("stamp");
          JSONObject current = null;
          try {
            current = new R2DeviceGallery(context).one(id);
          } catch (R2Exception | SecurityException unavailable) {
          }
          String hash;
          if (current != null && stamp.equals(R2DeviceGallery.stamp(current)))
            hash = fingerprint(context, db, current, stopped);
          else {
            JSONObject savedHash = db.choice("file-hash:" + id);
            if (!stamp.equals(savedHash.optString("stamp"))
                || !savedHash.optString("hash").matches("[a-f0-9]{64}")) continue;
            hash = savedHash.getString("hash");
          }
          String digest = R2Policy.digest(row.toString().getBytes(StandardCharsets.UTF_8));
          String lookup = "recovery-object:" + hash;
          JSONObject saved = db.choice(lookup);
          String key;
          if (digest.equals(saved.optString("digest"))
              && scope.equals(saved.optString("scope"))
              && saved.optString("key").startsWith(prefix(keys))) key = saved.getString("key");
          else {
            key = prefix(keys) + "photos/" + UUID.randomUUID() + ".atlas";
            put(
                client,
                keys,
                key,
                new JSONObject()
                    .put("format", "life-atlas-gallery-photo")
                    .put("version", 1)
                    .put("hash", hash)
                    .put("row", row));
            db.choice(
                lookup, new JSONObject().put("digest", digest).put("scope", scope).put("key", key));
          }
          refs.put(
              new JSONObject()
                  .put("key", key)
                  .put("hash", hash)
                  .put("size", media.optLong("size"))
                  .put("oldId", id));
          progress(service, "saving", ++done, total, "");
        }
      }
      if (stopped.getAsBoolean() || !status(service).optBoolean("enabled"))
        throw new InterruptedIOException();
      JSONObject staged = db.choice("recovery-staged");
      if (staged.optJSONArray("photos") != null) {
        Set<String> present = new HashSet<>();
        for (int i = 0; i < refs.length(); i++)
          present.add(refs.getJSONObject(i).getString("hash"));
        Map<String, String> pendingMap = new HashMap<>();
        JSONArray pending = staged.getJSONArray("photos");
        for (int i = 0; i < pending.length(); i++) {
          JSONObject ref = pending.getJSONObject(i);
          String hash = ref.getString("hash");
          if (present.contains(hash)) continue;
          if (stopped.getAsBoolean()) throw new InterruptedIOException();
          if (!scope.equals(R2Duplicates.scope(repo.store.credentials("private"))))
            throw new R2Exception("CONFIGURATION_CHANGED");
          JSONObject stored = db.choice("restore-photo:" + hash).optJSONObject("row");
          if (stored == null) throw new R2Exception("INVALID_GALLERY_RECOVERY");
          JSONObject row = namespacePending(stored, hash, pendingMap);
          if (db.choice("recovery-settings").optBoolean("denyRecoveredFaces")) {
            row.remove("faces");
            row.remove("faceVersion");
          }
          String digest = R2Policy.digest(row.toString().getBytes(StandardCharsets.UTF_8)),
              lookup = "recovery-object:" + hash;
          JSONObject saved = db.choice(lookup);
          String key;
          if (digest.equals(saved.optString("digest")) && scope.equals(saved.optString("scope")))
            key = saved.getString("key");
          else {
            key = prefix(keys) + "photos/" + UUID.randomUUID() + ".atlas";
            put(
                client,
                keys,
                key,
                new JSONObject()
                    .put("format", "life-atlas-gallery-photo")
                    .put("version", 1)
                    .put("hash", hash)
                    .put("row", row));
            db.choice(
                lookup, new JSONObject().put("digest", digest).put("scope", scope).put("key", key));
          }
          refs.put(
              new JSONObject()
                  .put("key", key)
                  .put("hash", hash)
                  .put("size", row.getJSONObject("media").optLong("size"))
                  .put("oldId", row.getJSONObject("media").getString("id")));
        }
        JSONObject oldChoices = staged.optJSONObject("choices");
        if (oldChoices != null)
          for (String name : CHOICES) {
            if (name.equals("people")
                && db.choice("recovery-settings").optBoolean("denyRecoveredFaces")) continue;
            JSONObject old = oldChoices.optJSONObject(name);
            if (old == null) continue;
            JSONObject missing = project(name, old, pendingMap),
                current = choices.getJSONObject(name);
            if (name.equals("media-preferences")) {
              Set<String> favorites =
                  new LinkedHashSet<>(GalleryPeople.set(current.optJSONArray("favorites")));
              favorites.addAll(GalleryPeople.set(missing.optJSONArray("favorites")));
              current.put("favorites", new JSONArray(favorites));
            }
            if (name.equals("people"))
              for (String field : List.of("excluded", "separated")) {
                Set<String> entries =
                    new LinkedHashSet<>(GalleryPeople.set(current.optJSONArray(field)));
                entries.addAll(GalleryPeople.set(missing.optJSONArray(field)));
                current.put(field, new JSONArray(entries));
              }
            mergeMissing(current, missing);
          }
      }
      // A snapshot is immutable. Later local edits remain dirty for the next save.
      JSONObject manifest =
          new JSONObject()
              .put("format", "life-atlas-gallery-analysis")
              .put("version", 1)
              .put("created", System.currentTimeMillis())
              .put("photos", refs)
              .put("choices", choices);
      String key =
          prefix(keys)
              + "snapshots/"
              + System.currentTimeMillis()
              + "-"
              + UUID.randomUUID()
              + ".atlas";
      put(client, keys, key, manifest);
      synchronized (GalleryIntelligence.STATE_LOCK) {
        JSONObject v = db.choice("recovery-settings");
        v.put("lastSaved", System.currentTimeMillis())
            .put("savedRevision", revision)
            .put("state", "saved")
            .put("lastKey", key)
            .put("processed", refs.length())
            .put("total", refs.length());
        db.choice("recovery-settings", v);
      }
    } finally {
      Arrays.fill(keys, (byte) 0);
    }
  }

  static void restore(Context context, boolean faces, java.util.function.BooleanSupplier stopped)
      throws Exception {
    R2Repository repo = new R2Repository(context);
    GalleryIntelligence service = new GalleryIntelligence(context);
    byte[] keys = repo.keyset();
    try (GallerySearchStore db = new GallerySearchStore(service.secure)) {
      R2Client client = new R2Client(repo.store.credentials("private"));
      String cursor = "", latest = "";
      int seen = 0;
      do {
        JSONObject page = client.list(prefix(keys) + "snapshots/", cursor);
        JSONArray items = page.getJSONArray("objects");
        for (int i = 0; i < items.length(); i++) {
          if (++seen > 20000) throw new R2Exception("GALLERY_RECOVERY_LIMIT");
          String k = items.getJSONObject(i).getString("key");
          if (k.endsWith(".atlas") && k.compareTo(latest) > 0) latest = k;
        }
        cursor = page.optString("cursor");
        if (stopped.getAsBoolean()) throw new InterruptedIOException();
      } while (!cursor.isEmpty());
      if (latest.isEmpty()) throw new R2Exception("GALLERY_RECOVERY_NOT_FOUND");
      JSONObject manifest = get(client, keys, latest);
      validateManifest(manifest);
      if (!faces) manifest.getJSONObject("choices").remove("people");
      JSONArray refs = manifest.getJSONArray("photos");
      for (int i = 0; i < refs.length(); i++) {
        if (stopped.getAsBoolean()) throw new InterruptedIOException();
        JSONObject ref = refs.getJSONObject(i);
        JSONObject photo = get(client, keys, ref.getString("key"));
        if (!"life-atlas-gallery-photo".equals(photo.optString("format"))
            || photo.optInt("version") != 1
            || !ref.getString("hash").equals(photo.optString("hash")))
          throw new R2Exception("INVALID_GALLERY_RECOVERY");
        if (!faces || status(service).optBoolean("denyRecoveredFaces")) {
          photo.getJSONObject("row").remove("faces");
          photo.getJSONObject("row").remove("faceVersion");
        }
        db.choice("restore-photo:" + ref.getString("hash"), photo);
        progress(service, "restoring", i + 1, refs.length(), "");
      }
      // Stage everything before applying, so an interrupted download does not overwrite names.
      manifest
          .put("restoreFaces", faces)
          .put("idMap", new JSONObject())
          .put("faceMap", new JSONObject());
      synchronized (GalleryIntelligence.STATE_LOCK) {
        if (stopped.getAsBoolean()) throw new InterruptedIOException();
        if (db.choice("recovery-settings").optBoolean("denyRecoveredFaces")) {
          manifest.put("restoreFaces", false);
          manifest.getJSONObject("choices").remove("people");
        }
        db.choice("recovery-staged", manifest);
      }
    } finally {
      Arrays.fill(keys, (byte) 0);
    }
    reconnect(context, stopped);
  }

  static void validateManifest(JSONObject manifest) throws Exception {
    if (!"life-atlas-gallery-analysis".equals(manifest.optString("format"))
        || manifest.optInt("version") != 1
        || manifest.optJSONArray("photos") == null
        || manifest.getJSONArray("photos").length() > 100000
        || manifest.optJSONObject("choices") == null)
      throw new R2Exception("INVALID_GALLERY_RECOVERY");
    JSONArray refs = manifest.getJSONArray("photos");
    for (int i = 0; i < refs.length(); i++)
      if (!refs.getJSONObject(i).optString("hash").matches("[a-f0-9]{64}"))
        throw new R2Exception("INVALID_GALLERY_RECOVERY");
  }

  static JSONObject namespacePending(
      JSONObject source, String hash, Map<String, String> replacements) throws Exception {
    JSONObject row = new JSONObject(source.toString());
    String oldId = row.getJSONObject("media").getString("id"),
        id = "recovered:" + hash,
        stamp = row.optString("stamp");
    replacements.put(oldId, id);
    replacements.put(oldId + "|" + stamp, id + "|" + stamp);
    row.getJSONObject("media").put("id", id);
    JSONArray faces = row.optJSONArray("faces");
    if (faces != null)
      for (int i = 0; i < faces.length(); i++) {
        JSONObject face = faces.getJSONObject(i);
        String before = face.getString("id"),
            after = GallerySearchStore.token(id) + before.substring(64);
        face.put("id", after);
        replacements.put(before, after);
      }
    return row;
  }

  static List<String> keys(JSONObject value) {
    List<String> keys = new ArrayList<>();
    java.util.Iterator<String> it = value.keys();
    while (it.hasNext()) keys.add(it.next());
    return keys;
  }

  static JSONObject project(String name, JSONObject value, Map<String, String> map)
      throws Exception {
    JSONObject out = remap(value, map);
    if (name.equals("edits")) {
      JSONObject kept = new JSONObject();
      for (String key : keys(value))
        if (map.containsKey(key)) {
          JSONObject edit = value.getJSONObject(key);
          if (map.containsKey(edit.optString("originalKey")))
            kept.put(map.get(key), remap(edit, map));
        }
      return kept;
    }
    if (name.equals("viewer-state")) {
      JSONObject kept = new JSONObject();
      for (String field : List.of("positions", "covers")) {
        JSONObject source = value.optJSONObject(field), members = new JSONObject();
        if (source != null)
          for (String key : keys(source))
            if (map.containsKey(key)) members.put(map.get(key), source.get(key));
        kept.put(field, members);
      }
      return kept;
    }
    if (name.equals("albums")) {
      JSONObject all = value.optJSONObject("items"), safe = new JSONObject();
      if (all != null)
        for (String id : keys(all)) {
          JSONObject album = all.getJSONObject(id),
              copy = new JSONObject(album.toString()),
              members = album.optJSONObject("members"),
              kept = new JSONObject();
          if (members != null)
            for (String key : keys(members)) if (map.containsKey(key)) kept.put(map.get(key), true);
          copy.put("members", kept);
          if (map.containsKey(album.optString("cover")))
            copy.put("cover", map.get(album.getString("cover")));
          else copy.put("cover", "");
          safe.put(id, copy);
        }
      out.put("items", safe);
    } else if (name.equals("people")) {
      for (String field : List.of("assignments", "covers")) {
        JSONObject source = value.optJSONObject(field), kept = new JSONObject();
        if (source != null)
          for (String key : keys(source)) {
            String reference = field.equals("assignments") ? key : source.optString(key);
            if (map.containsKey(reference))
              kept.put(
                  field.equals("assignments") ? map.get(key) : key,
                  field.equals("assignments") ? source.get(key) : map.get(reference));
          }
        out.put(field, kept);
      }
      for (String field : List.of("excluded", "separated")) {
        JSONArray source = value.optJSONArray(field), kept = new JSONArray();
        if (source != null)
          for (int i = 0; i < source.length(); i++)
            if (map.containsKey(source.getString(i))) kept.put(map.get(source.getString(i)));
        out.put(field, kept);
      }
      JSONObject refs = value.optJSONObject("references"), safeRefs = new JSONObject();
      if (refs != null)
        for (String person : keys(refs)) {
          JSONArray ids = refs.getJSONArray(person), kept = new JSONArray();
          for (int i = 0; i < ids.length(); i++)
            if (map.containsKey(ids.getString(i))) kept.put(map.get(ids.getString(i)));
          safeRefs.put(person, kept);
        }
      out.put("references", safeRefs);
      JSONObject rules = value.optJSONObject("neverTogether"), safeRules = new JSONObject();
      if (rules != null)
        for (String key : keys(rules)) {
          JSONObject rule = rules.getJSONObject(key), copy = remap(rule, map);
          for (String field : List.of("leftFaces", "rightFaces")) {
            JSONArray ids = rule.optJSONArray(field), kept = new JSONArray();
            if (ids != null)
              for (int i = 0; i < ids.length(); i++)
                if (map.containsKey(ids.getString(i))) kept.put(map.get(ids.getString(i)));
            copy.put(field, kept);
          }
          safeRules.put(key, copy);
        }
      out.put("neverTogether", safeRules);
      JSONObject rejected = out.optJSONObject("notSame"), restoredRejected = new JSONObject();
      if (rejected != null)
        for (String key : keys(rejected)) {
          JSONObject pair = rejected.optJSONObject(key);
          if (pair != null
              && !pair.optString("left").isEmpty()
              && !pair.optString("right").isEmpty())
            restoredRejected.put(
                GalleryPeople.pair(pair.getString("left"), pair.getString("right")), pair);
        }
      out.put("notSame", restoredRejected);
    } else if (name.equals("media-preferences")) {
      JSONArray source = value.optJSONArray("favorites"), kept = new JSONArray();
      if (source != null)
        for (int i = 0; i < source.length(); i++)
          if (map.containsKey(source.getString(i))) kept.put(map.get(source.getString(i)));
      out.put("favorites", kept);
    } else if (name.equals("similar")) {
      JSONObject source = value.optJSONObject("sourcePicks"), kept = new JSONObject();
      if (source != null)
        for (String key : keys(source))
          if (map.containsKey(key)) kept.put(map.get(key), source.get(key));
      out.put("sourcePicks", kept);
      JSONArray excluded = value.optJSONArray("excluded"), safe = new JSONArray();
      if (excluded != null)
        for (int i = 0; i < excluded.length(); i++)
          if (map.containsKey(excluded.getString(i))) safe.put(map.get(excluded.getString(i)));
      out.put("excluded", safe);
      out.remove("picks");
      out.remove("hidden");
      JSONObject hidden = value.optJSONObject("hiddenGroups"), newGroups = new JSONObject();
      JSONArray newHidden = new JSONArray();
      if (hidden != null)
        for (String key : keys(hidden)) {
          JSONArray sources = hidden.getJSONArray(key);
          List<String> connected = new ArrayList<>();
          for (int i = 0; i < sources.length(); i++)
            if (map.containsKey(sources.getString(i))) connected.add(map.get(sources.getString(i)));
          if (connected.size() == sources.length()) {
            Collections.sort(connected);
            String id = "similar:" + GallerySearchStore.token(String.join("\n", connected));
            newGroups.put(id, new JSONArray(connected));
            newHidden.put(id);
          }
        }
      out.put("hidden", newHidden).put("hiddenGroups", newGroups);
    }
    return out;
  }

  static JSONObject remap(JSONObject value, Map<String, String> replacements) throws Exception {
    return (JSONObject) remapValue(value, replacements);
  }

  static Object remapValue(Object value, Map<String, String> map) throws Exception {
    if (value instanceof JSONObject) {
      JSONObject out = new JSONObject();
      JSONObject in = (JSONObject) value;
      for (String key : keys(in)) out.put(remapString(key, map), remapValue(in.get(key), map));
      return out;
    }
    if (value instanceof JSONArray) {
      JSONArray out = new JSONArray();
      JSONArray in = (JSONArray) value;
      for (int i = 0; i < in.length(); i++) out.put(remapValue(in.get(i), map));
      return out;
    }
    return value instanceof String ? remapString((String) value, map) : value;
  }

  static String remapString(String value, Map<String, String> map) {
    if (map.containsKey(value)) return map.get(value);
    if (value.startsWith("candidate:") && map.containsKey(value.substring(10)))
      return "candidate:" + map.get(value.substring(10));
    return value;
  }

  static void reconnect(Context context, java.util.function.BooleanSupplier stopped)
      throws Exception {
    reconnect(context, new GalleryIntelligence(context), new R2DeviceGallery(context), stopped);
  }

  static void reconnect(
      Context context,
      GalleryIntelligence service,
      R2DeviceGallery gallery,
      java.util.function.BooleanSupplier stopped)
      throws Exception {
    try (GallerySearchStore db = new GallerySearchStore(service.secure)) {
      JSONObject manifest = db.choice("recovery-staged");
      if (manifest.length() == 0) return;
      validateManifest(manifest);
      boolean faces =
          manifest.optBoolean("restoreFaces") && !status(service).optBoolean("denyRecoveredFaces");
      Map<String, String> map = new HashMap<>();
      JSONObject idMap = manifest.getJSONObject("idMap"),
          faceMap = manifest.getJSONObject("faceMap");
      for (String k : keys(idMap)) map.put(k, idMap.getString(k));
      for (String k : keys(faceMap)) map.put(k, faceMap.getString(k));
      Set<Long> sizes = new HashSet<>();
      JSONArray refs = manifest.getJSONArray("photos");
      Map<String, JSONObject> byHash = new HashMap<>();
      for (int i = 0; i < refs.length(); i++) {
        JSONObject ref = refs.getJSONObject(i);
        sizes.add(ref.optLong("size"));
        byHash.put(ref.getString("hash"), ref);
      }
      String cursor = "";
      int matched = 0;
      do {
        JSONObject page = gallery.list(cursor, "", "photo", "", "newest");
        JSONArray items = page.getJSONArray("items");
        for (int i = 0; i < items.length(); i++) {
          if (stopped.getAsBoolean()) throw new InterruptedIOException();
          JSONObject media = items.getJSONObject(i);
          if (!sizes.contains(media.optLong("size"))) continue;
          String hash = fingerprint(context, db, media, stopped);
          JSONObject ref = byHash.get(hash);
          if (ref == null) continue;
          JSONObject row =
              new JSONObject(db.choice("restore-photo:" + hash).getJSONObject("row").toString());
          String oldId = row.getJSONObject("media").getString("id"),
              oldStamp = row.optString("stamp"),
              id = media.getString("id"),
              stamp = R2DeviceGallery.stamp(media);
          idMap.put(oldId, id).put(oldId + "|" + oldStamp, id + "|" + stamp);
          map.put(oldId, id);
          map.put(oldId + "|" + oldStamp, id + "|" + stamp);
          JSONObject existing = db.get(id);
          if (existing != null && !stamp.equals(existing.optString("stamp"))) existing = null;
          JSONArray existingFaces = existing == null ? null : existing.optJSONArray("faces");
          JSONArray detected = row.optJSONArray("faces");
          if (faces
              && GalleryFaceModels.VERSION.equals(row.optString("faceVersion"))
              && detected != null) {
            for (int f = 0; f < detected.length(); f++) {
              JSONObject face = detected.getJSONObject(f);
              String before = face.getString("id"),
                  after = GallerySearchStore.token(id) + before.substring(64);
              if (existingFaces != null) {
                for (int e = 0; e < existingFaces.length(); e++) {
                  JSONObject candidate = existingFaces.getJSONObject(e);
                  JSONArray a = face.optJSONArray("embedding"),
                      b = candidate.optJSONArray("embedding");
                  double dot = 0;
                  if (a != null && b != null && a.length() == 128 && b.length() == 128) {
                    for (int n = 0; n < 128; n++) dot += a.getDouble(n) * b.getDouble(n);
                    if (dot > .98) {
                      after = candidate.getString("id");
                      break;
                    }
                  }
                }
              }
              face.put("id", after);
              faceMap.put(before, after);
              map.put(before, after);
            }
          } else {
            row.remove("faces");
            row.remove("faceVersion");
          }
          row.put("media", media).put("stamp", stamp);
          synchronized (GalleryIntelligence.STATE_LOCK) {
            if (db.choice("recovery-settings").optBoolean("denyRecoveredFaces")) {
              row.remove("faces");
              row.remove("faceVersion");
            }
            JSONObject live = db.get(id);
            if (live == null || !stamp.equals(live.optString("stamp"))) db.put(row);
            else {
              mergeMissing(live, row);
              db.put(live);
            }
          }
          matched++;
        }
        cursor = page.optString("cursor");
        progress(service, "matching", matched, refs.length(), "");
      } while (!cursor.isEmpty());
      if (stopped.getAsBoolean()) throw new InterruptedIOException();
      synchronized (GalleryIntelligence.STATE_LOCK) {
        JSONObject choices = manifest.getJSONObject("choices");
        for (String name : CHOICES) {
          if (name.equals("people")
              && (!faces || db.choice("recovery-settings").optBoolean("denyRecoveredFaces")))
            continue;
          JSONObject recovered =
              project(
                  name,
                  choices.optJSONObject(name) == null
                      ? new JSONObject()
                      : choices.getJSONObject(name),
                  map);
          if (name.equals("albums")) {
            GalleryAlbums.restore(db, recovered);
            continue;
          }
          JSONObject current = db.choice(name);
          if (name.equals("media-preferences")) {
            Set<String> applied = GalleryPeople.set(manifest.optJSONArray("appliedFavorites"));
            Set<String> favorites =
                new LinkedHashSet<>(GalleryPeople.set(current.optJSONArray("favorites")));
            Set<String> incoming = GalleryPeople.set(recovered.optJSONArray("favorites"));
            for (String id : incoming) if (!applied.contains(id)) favorites.add(id);
            current.put("favorites", new JSONArray(favorites));
            applied.addAll(incoming);
            manifest.put("appliedFavorites", new JSONArray(applied));
          }
          mergeMissing(current, recovered);
          db.choice(name, current);
        }
        if (faces && !db.choice("recovery-settings").optBoolean("denyRecoveredFaces")) {
          JSONObject config = service.settings();
          config.put("people", true);
          if (!config.has("epoch")) config.put("state", "paused").put("albums", new JSONArray());
          service.writeSettings(config);
        }
        manifest.put("idMap", idMap).put("faceMap", faceMap);
        db.choice("recovery-staged", manifest);
        JSONObject state = db.choice("recovery-settings");
        state
            .put("state", "restored")
            .put("lastRestored", System.currentTimeMillis())
            .put("matched", matched)
            .put("total", refs.length())
            .put("unmatched", Math.max(0, refs.length() - matched));
        db.choice("recovery-settings", state);
      }
    }
    new GalleryCollections(context, service, gallery).warm();
  }

  static void mergeMissing(JSONObject current, JSONObject recovered) throws Exception {
    for (String k : keys(recovered)) {
      if (!current.has(k)) current.put(k, recovered.get(k));
      else if (current.optJSONObject(k) != null && recovered.optJSONObject(k) != null)
        mergeMissing(current.getJSONObject(k), recovered.getJSONObject(k));
    }
  }
}
