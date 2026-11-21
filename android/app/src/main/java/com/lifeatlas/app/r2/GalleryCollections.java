package com.lifeatlas.app.r2;

import android.content.Context;
import java.util.*;
import org.json.*;

/**
 * Narrow bridge for private collections. Never returns embeddings, raw OCR or source file bytes.
 */
final class GalleryCollections {
  private final Context context;
  private final GalleryIntelligence service;
  private final R2DeviceGallery gallery;

  GalleryCollections(Context c) {
    this(c, new GalleryIntelligence(c), new R2DeviceGallery(c));
  }

  GalleryCollections(Context c, GalleryIntelligence service, R2DeviceGallery gallery) {
    this.context = c;
    this.service = service;
    this.gallery = gallery;
  }

  static int offset(String cursor) throws Exception {
    if (cursor == null || cursor.isEmpty()) return 0;
    if (!cursor.matches("[0-9]{1,7}")) throw new R2Exception("INVALID_SELECTION");
    return Integer.parseInt(cursor);
  }

  JSONObject list(String kind, String cursor) throws Exception {
    JSONObject config = service.settings();
    try (GallerySearchStore db = new GallerySearchStore(service.secure)) {
      JSONObject snapshot = snapshot(kind, db, config);
      boolean partial = snapshot.optBoolean("partial"),
          needs = snapshot.optBoolean("needsAnalysis");
      int start = offset(cursor);
      JSONObject page = db.cache(kind, "page:" + start);
      if (page.length() == 0) throw new R2Exception("INVALID_SELECTION");
      return page.put("partial", partial)
          .put("needsAnalysis", needs)
          .put("analysisState", config.optString("state", "off"))
          .put("hiddenPeople", GalleryPeople.set(db.choice("people").optJSONArray("hidden")).size())
          .put("canUndoPeople", db.choice("people-undo").optBoolean("saved"))
          .put(
              "hiddenMemories",
              kind.equals("memories")
                  ? GalleryPeople.set(db.choice("memories").optJSONArray("hidden")).size()
                  : 0);
    }
  }

  JSONObject snapshot(String kind, GallerySearchStore db, JSONObject config) throws Exception {
    if (!Set.of("similar", "people", "memories").contains(kind))
      throw new R2Exception("INVALID_SELECTION");
    long revision = db.revision();
    String scope =
        kind
            + ":"
            + config.optBoolean(kind)
            + ":"
            + Objects.toString(config.optJSONArray("albums"), "[]")
            + (kind.equals("memories") ? ":" + java.time.LocalDate.now() : "");
    JSONObject cached = db.cache(kind, "info");
    if (cached.optLong("revision", -1) == revision && scope.equals(cached.optString("scope")))
      return cached;
    List<JSONObject> summaries;
    JSONObject groups = new JSONObject();
    boolean partial = false, needs = false;
    if (kind.equals("memories"))
      summaries =
          GallerySmartAlbums.summaries(
              context, db, System.currentTimeMillis(), TimeZone.getDefault());
    else if (!config.optBoolean(kind)) {
      summaries = List.of();
      needs = true;
    } else {
      GalleryIndexedPhotos index =
          new GalleryIndexedPhotos(
              context, db, config, kind.equals("similar"), kind.equals("people"));
      partial = index.partial;
      if (kind.equals("similar")) {
        GallerySimilar similar = new GallerySimilar(index, db.choice("similar"));
        partial |= similar.partial;
        summaries = similar.summaries();
        for (GallerySimilar.Group g : similar.groups) {
          JSONArray ids = new JSONArray();
          for (GalleryIndexedPhotos.Photo p : g.photos) ids.put(p.id);
          groups.put(
              g.key,
              new JSONObject().put("ids", ids).put("bestId", g.best).put("pickedId", g.pick));
        }
      } else {
        GalleryPeople people = new GalleryPeople(index, db.choice("people"));
        summaries = people.summaries();
        JSONArray names = new JSONArray();
        for (GalleryPeople.Group g : people.groups)
          if (g.confirmed && names.length() < 2000)
            names.put(new JSONObject().put("id", g.id).put("name", g.name));
        for (GalleryPeople.Group g : people.groups) {
          JSONArray faces = new JSONArray();
          for (GalleryIndexedPhotos.Face f : g.faces)
            faces.put(new JSONObject().put("id", f.id).put("mediaId", f.mediaId));
          groups.put(
              g.id,
              new JSONObject()
                  .put("ids", new JSONArray(g.photos))
                  .put("faces", faces)
                  .put("people", names));
        }
      }
    }
    JSONObject result =
        new JSONObject()
            .put("revision", revision)
            .put("scope", scope)
            .put("collections", new JSONArray(summaries))
            .put("groups", groups)
            .put("partial", partial)
            .put("needsAnalysis", needs);
    db.saveCollections(kind, result);
    result.remove("collections");
    result.remove("groups");
    return result;
  }

  void warm() throws Exception {
    JSONObject config = service.settings();
    try (GallerySearchStore db = new GallerySearchStore(service.secure)) {
      for (String kind : List.of("similar", "people", "memories")) snapshot(kind, db, config);
    }
  }

  JSONObject media(String kind, String key, String cursor) throws Exception {
    offset(cursor);
    if (kind.equals("memories"))
      return gallery.smartPage(
          cursor,
          GallerySmartAlbums.filter(key, System.currentTimeMillis(), TimeZone.getDefault()));
    JSONObject config = service.settings();
    if (!Set.of("people", "similar").contains(kind) || !config.optBoolean(kind))
      throw new R2Exception("SEARCH_NOT_CONFIGURED");
    try (GallerySearchStore db = new GallerySearchStore(service.secure)) {
      snapshot(kind, db, config);
      int start = offset(cursor);
      JSONObject group = db.cache(kind, "media:" + key + ":" + start);
      if (group.length() == 0) throw new R2Exception("GALLERY_COLLECTION_CHANGED");
      JSONArray ids = group.getJSONArray("ids"), items = new JSONArray();
      for (int i = 0; i < ids.length(); i++)
        try {
          items.put(gallery.one(ids.getString(i)));
        } catch (R2Exception | SecurityException ignored) {
        }
      String best = group.optString("bestId"), pick = group.optString("pickedId");

      return new JSONObject()
          .put("items", items)
          .put("cursor", group.optString("cursor"))
          .put("complete", group.optBoolean("complete"))
          .put("bestId", best)
          .put("pickedId", pick);
    }
  }

  JSONObject facePage(String key, String cursor) throws Exception {
    if (!service.settings().optBoolean("people")) throw new R2Exception("SEARCH_NOT_CONFIGURED");
    try (GallerySearchStore db = new GallerySearchStore(service.secure)) {
      snapshot("people", db, service.settings());
      JSONObject group = db.cache("people", "faces:" + key + ":" + offset(cursor));
      if (group.length() == 0) throw new R2Exception("GALLERY_COLLECTION_CHANGED");
      JSONArray all = group.getJSONArray("faces"),
          faces = all,
          names = db.cache("people", "names").getJSONArray("people");
      int start = 0, end = all.length();
      JSONArray media = new JSONArray();
      Set<String> mediaIds = new LinkedHashSet<>();
      for (int i = start; i < end; i++) mediaIds.add(all.getJSONObject(i).getString("mediaId"));
      for (String id : mediaIds)
        try {
          media.put(gallery.one(id));
        } catch (R2Exception | SecurityException ignored) {
        }
      return new JSONObject()
          .put("media", media)
          .put("faces", faces)
          .put("people", names)
          .put("cursor", group.optString("cursor"))
          .put("complete", group.optBoolean("complete"));
    }
  }

  JSONObject thumbnail(String faceId) throws Exception {
    if (!service.settings().optBoolean("people")
        || !faceId.matches("[0-9a-f]{64}\\.[0-9]{1,2}\\.[0-9a-f]{16}"))
      throw new R2Exception("INVALID_SELECTION");
    try (GallerySearchStore db = new GallerySearchStore(service.secure)) {
      if (GalleryPeople.set(db.choice("people").optJSONArray("excluded")).contains(faceId))
        throw new R2Exception("SOURCE_UNAVAILABLE");
      JSONObject row = db.byToken(faceId.substring(0, 64));
      if (row == null || !GalleryFaceModels.VERSION.equals(row.optString("faceVersion")))
        throw new R2Exception("SOURCE_UNAVAILABLE");
      JSONObject media = gallery.one(row.getJSONObject("media").getString("id"));
      if (!R2DeviceGallery.stamp(media).equals(row.optString("stamp")))
        throw new R2Exception("SOURCE_CHANGED");
      JSONArray faces = row.getJSONArray("faces");
      for (int i = 0; i < faces.length(); i++) {
        JSONObject face = faces.getJSONObject(i);
        if (faceId.equals(face.optString("id")))
          return new JSONObject()
              .put("thumbnail", "data:image/jpeg;base64," + face.getString("crop"));
      }
      throw new R2Exception("SOURCE_UNAVAILABLE");
    }
  }

  void edit(JSONObject input) throws Exception {
    String action = input.optString("action"), key = input.optString("key");
    if (key.length() > 200) throw new R2Exception("INVALID_SELECTION");
    if (action.equals("reset-similar") || action.equals("restore-memories")) {
      synchronized (GalleryIntelligence.STATE_LOCK) {
        try (GallerySearchStore db = new GallerySearchStore(service.secure)) {
          db.choice(action.equals("reset-similar") ? "similar" : "memories", new JSONObject());
        }
      }
      return;
    }
    if (action.equals("undo-people")) {
      synchronized (GalleryIntelligence.STATE_LOCK) {
        try (GallerySearchStore db = new GallerySearchStore(service.secure)) {
          JSONObject undo = db.choice("people-undo");
          if (!undo.optBoolean("saved")) throw new R2Exception("NOTHING_TO_UNDO");
          db.choice("people", undo.getJSONObject("choices"));
          db.forgetChoices("people-undo");
        }
      }
      return;
    }
    if (action.equals("forget-people")) {
      JSONObject config = service.settings();
      boolean wasEnabled = config.optBoolean("enabled");
      service.control("pause");
      synchronized (GalleryIntelligence.STATE_LOCK) {
        JSONObject stopped = service.settings();
        stopped.put("people", false);
        service.writeSettings(stopped);
        try (GallerySearchStore db = new GallerySearchStore(service.secure)) {
          GalleryPeople.forget(db);
          db.forgetChoices("people-undo");
        }
      }
      synchronized (GalleryClip.LOCK) {
        GalleryFaceModels.remove(context);
      }
      if (wasEnabled
          && (config.optBoolean("ocr")
              || config.optBoolean("visual")
              || config.optBoolean("similar"))) service.control("resume");
      return;
    }
    synchronized (GalleryIntelligence.STATE_LOCK) {
      try (GallerySearchStore db = new GallerySearchStore(service.secure)) {
        if (action.equals("hide-memory")) {
          GallerySmartAlbums.filter(key, System.currentTimeMillis(), TimeZone.getDefault());
          if (!key.startsWith("memory:")) throw new R2Exception("INVALID_SELECTION");
          JSONObject state = db.choice("memories");
          Set<String> hidden = GalleryPeople.set(state.optJSONArray("hidden"));
          hidden.add(key);
          state.put("hidden", new JSONArray(new TreeSet<>(hidden)));
          db.choice("memories", state);
          return;
        }
        JSONObject config = service.settings();
        if (Set.of("pick", "separate-photo", "dismiss-similar").contains(action)) {
          if (!config.optBoolean("similar")) throw new R2Exception("SEARCH_NOT_CONFIGURED");
          JSONObject choices = db.choice("similar");
          GallerySimilar similar =
              new GallerySimilar(
                  new GalleryIndexedPhotos(context, db, config, true, false), choices);
          GallerySimilar.edit(choices, similar.group(key), action, input.optString("mediaId"));
          db.choice("similar", choices);
          return;
        }
        if (!config.optBoolean("people")) throw new R2Exception("SEARCH_NOT_CONFIGURED");
        JSONObject choices = db.choice("people");
        GalleryPeople people =
            new GalleryPeople(new GalleryIndexedPhotos(context, db, config, false, true), choices);
        db.choice(
            "people-undo",
            new JSONObject().put("saved", true).put("choices", new JSONObject(choices.toString())));
        people.edit(
            choices,
            action,
            key,
            input.optString("faceId"),
            input.optString("personId"),
            input.optString("name"));
        db.choice("people", choices);
        if (action.equals("exclude-face")) {
          String faceId = input.getString("faceId");
          JSONObject row = db.byToken(faceId.substring(0, 64));
          JSONArray kept = new JSONArray(), faces = row.getJSONArray("faces");
          for (int i = 0; i < faces.length(); i++)
            if (!faceId.equals(faces.getJSONObject(i).getString("id"))) kept.put(faces.get(i));
          row.put("faces", kept);
          db.put(row);
        }
      }
    }
  }
}
