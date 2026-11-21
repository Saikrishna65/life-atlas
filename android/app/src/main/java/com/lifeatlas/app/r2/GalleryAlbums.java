package com.lifeatlas.app.r2;

import android.content.Context;
import java.util.*;
import org.json.*;

/** Virtual albums: membership only. Camera originals and device folders are never moved. */
final class GalleryAlbums {
  static JSONObject index(GallerySearchStore db) throws Exception {
    return db.choice("albums");
  }

  static JSONObject get(GallerySearchStore db, String id) throws Exception {
    if (!id.matches("[a-f0-9-]{36}")) throw new R2Exception("INVALID_SELECTION");
    JSONObject value = db.choice("album:" + id);
    if (value.length() == 0) throw new R2Exception("ALBUM_NOT_FOUND");
    return value;
  }

  static List<String> order(GallerySearchStore db) throws Exception {
    JSONArray a = index(db).optJSONArray("order");
    List<String> ids = new ArrayList<>();
    if (a != null) for (int i = 0; i < a.length(); i++) ids.add(a.getString(i));
    return ids;
  }

  static JSONObject export(GallerySearchStore db) throws Exception {
    JSONObject items = new JSONObject();
    List<String> ids = order(db);
    for (String id : ids) items.put(id, get(db, id));
    return new JSONObject().put("order", new JSONArray(ids)).put("items", items);
  }

  static void restore(GallerySearchStore db, JSONObject saved) throws Exception {
    JSONObject albums = saved.optJSONObject("items");
    if (albums == null) return;
    List<String> ids = order(db);
    LinkedHashSet<String> restored = new LinkedHashSet<>();
    JSONArray savedOrder = saved.optJSONArray("order");
    if (savedOrder != null)
      for (int i = 0; i < savedOrder.length(); i++)
        if (albums.has(savedOrder.getString(i))) restored.add(savedOrder.getString(i));
    java.util.Iterator<String> keys = albums.keys();
    while (keys.hasNext()) restored.add(keys.next());
    for (String id : restored) {
      if (!id.matches("[a-f0-9-]{36}")) throw new R2Exception("INVALID_GALLERY_RECOVERY");
      JSONObject record = albums.getJSONObject(id), current = db.choice("album:" + id);
      GalleryRecovery.mergeMissing(current, record);
      if (current.optJSONObject("members") == null) current.put("members", new JSONObject());
      db.choice("album:" + id, current);
      if (!ids.contains(id)) ids.add(id);
    }
    db.choice("albums", new JSONObject().put("order", new JSONArray(ids)));
  }

  static String source(String key) {
    return key.substring(0, key.indexOf('|'));
  }

  static JSONObject snapshot(Context context, GallerySearchStore db) throws Exception {
    JSONArray cards = new JSONArray();
    JSONObject groups = new JSONObject();
    R2DeviceGallery gallery = new R2DeviceGallery(context);
    Set<String> wanted = new HashSet<>();
    for (String id : order(db)) {
      JSONObject members = get(db, id).optJSONObject("members");
      if (members != null) {
        java.util.Iterator<String> it = members.keys();
        while (it.hasNext()) wanted.add(source(it.next()));
      }
    }
    Map<String, String> accessible = gallery.accessibleVersions(wanted);
    for (String id : order(db)) {
      JSONObject album = get(db, id), members = album.optJSONObject("members");
      JSONArray ids = new JSONArray();
      if (members != null) {
        java.util.Iterator<String> it = members.keys();
        while (it.hasNext()) {
          String key = it.next();
          try {
            String member = source(key);
            if (key.equals(member + "|" + accessible.get(member))) ids.put(member);
          } catch (Exception ignored) {
          }
        }
      }
      String cover = album.optString("cover");
      boolean found = false;
      for (int i = 0; i < ids.length(); i++) if (ids.getString(i).equals(cover)) found = true;
      if (!found) cover = ids.length() > 0 ? ids.getString(0) : "";
      cards.put(
          new JSONObject()
              .put("id", id)
              .put("kind", "album")
              .put("title", album.getString("name"))
              .put("subtitle", "My album")
              .put("count", ids.length())
              .put("coverId", cover));
      groups.put(id, new JSONObject().put("ids", ids));
    }
    return new JSONObject().put("collections", cards).put("groups", groups);
  }

  static JSONObject edit(Context context, GallerySearchStore db, JSONObject input)
      throws Exception {
    String action = input.optString("action"), id = input.optString("id");
    List<String> ids = order(db);
    JSONObject album;
    if (action.equals("create")) {
      if (ids.size() >= 500) throw new R2Exception("ALBUM_LIMIT");
      id = UUID.randomUUID().toString();
      album =
          new JSONObject()
              .put("name", name(input.optString("name")))
              .put("members", new JSONObject())
              .put("created", System.currentTimeMillis());
      ids.add(id);
    } else {
      if (!ids.contains(id)) throw new R2Exception("ALBUM_NOT_FOUND");
      album = get(db, id);
    }
    if (action.equals("rename")) album.put("name", name(input.optString("name")));
    if (action.equals("add") || action.equals("create")) {
      JSONArray selected = input.optJSONArray("ids");
      if (selected != null) {
        if (selected.length() > 500) throw new R2Exception("SELECTION_LIMIT_EXCEEDED");
        JSONObject members = album.getJSONObject("members");
        R2DeviceGallery gallery = new R2DeviceGallery(context);
        for (int i = 0; i < selected.length(); i++) {
          JSONObject media = gallery.one(selected.getString(i));
          members.put(media.getString("id") + "|" + R2DeviceGallery.stamp(media), true);
          if (db.get(media.getString("id")) == null)
            db.put(new JSONObject().put("media", media).put("stamp", R2DeviceGallery.stamp(media)));
        }
        if (members.length() > 10000) throw new R2Exception("ALBUM_LIMIT");
      }
    } else if (action.equals("remove")) {
      JSONArray selected = input.optJSONArray("ids");
      JSONObject members = album.getJSONObject("members");
      if (selected != null) {
        Set<String> removals = GalleryPeople.set(selected);
        List<String> remove = new ArrayList<>();
        java.util.Iterator<String> keys = members.keys();
        while (keys.hasNext()) {
          String key = keys.next();
          if (removals.contains(source(key))) remove.add(key);
        }
        for (String key : remove) members.remove(key);
      }
    } else if (action.equals("cover")) {
      String cover = input.optString("cover");
      boolean found = false;
      java.util.Iterator<String> keys = album.getJSONObject("members").keys();
      while (keys.hasNext()) if (source(keys.next()).equals(cover)) found = true;
      if (!found) throw new R2Exception("INVALID_SELECTION");
      album.put("cover", cover);
    } else if (action.equals("move")) {
      int before = ids.indexOf(id),
          after = Math.max(0, Math.min(ids.size() - 1, before + input.optInt("direction")));
      ids.remove(before);
      ids.add(after, id);
    } else if (action.equals("delete")) {
      ids.remove(id);
      db.forgetChoices("album:" + id);
    } else if (!action.equals("rename")) throw new R2Exception("INVALID_SELECTION");
    if (!action.equals("delete")) db.choice("album:" + id, album);
    db.choice("albums", new JSONObject().put("order", new JSONArray(ids)));
    db.invalidate();
    return new JSONObject().put("id", id);
  }

  static String name(String value) throws Exception {
    String clean = value.trim();
    if (clean.isEmpty() || clean.length() > 100) throw new R2Exception("INVALID_ALBUM_NAME");
    return clean;
  }
}
