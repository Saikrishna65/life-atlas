package com.lifeatlas.app.r2;

import java.nio.charset.StandardCharsets;
import java.util.*;
import org.json.*;

/** Independent, immutable publication records. Never overwrites a shared catalog. */
final class R2Publication {
  private final R2Credentials credentials;
  private final R2Transport client;

  R2Publication(R2Credentials credentials) {
    this(credentials, new R2Client(credentials));
  }

  R2Publication(R2Credentials credentials, R2Transport client) {
    this.credentials = credentials;
    this.client = client;
  }

  JSONObject publish(JSONObject job, JSONObject input) throws Exception {
    if (!input.optString("category").equals("expedition"))
      throw new R2Exception("INVALID_PUBLIC_METADATA");
    if (credentials.base.isEmpty()) throw new R2Exception("PUBLIC_BASE_URL_REQUIRED");
    JSONObject item = new R2Catalog(credentials, client).prepareItem(job, input);
    JSONArray identity = new JSONArray();
    for (String field :
        new String[] {
          "id",
          "key",
          "url",
          "title",
          "description",
          "category",
          "collection",
          "mimeType",
          "size",
          "tags",
          "metadataPolicy",
          "thumbnailUrl"
        }) identity.put(item.opt(field));
    String key =
        "atlas/catalog/publications/"
            + R2Policy.path(job.getString("id"))
            + "/"
            + R2Policy.digest(identity.toString().getBytes(StandardCharsets.UTF_8))
            + ".json";
    String manifestUrl = credentials.base + "/" + key;
    item.put("manifestUrl", manifestUrl);
    JSONObject document =
        new JSONObject()
            .put("format", "life-atlas-publication")
            .put("version", 1)
            .put("item", item);
    byte[] bytes = document.toString().getBytes(StandardCharsets.UTF_8);
    if (bytes.length > 131072) throw new R2Exception("INVALID_PUBLIC_METADATA");
    try (R2Client.Response ignored =
        client.request(
            "PUT",
            key,
            Collections.emptyMap(),
            Map.of(
                "Content-Type",
                "application/json; charset=utf-8",
                "Cache-Control",
                "public, max-age=31536000, immutable",
                "If-None-Match",
                "*"),
            R2Client.bytes(bytes),
            null)) {
      return new JSONObject().put("item", item).put("manifestKey", key);
    } catch (R2Exception error) {
      if (!error.code.equals("CATALOG_CONFLICT")) throw error;
      // A retry may find its own committed immutable record. Verify, never overwrite it.
      try (R2Client.Response response =
          client.request(
              "GET",
              key,
              Collections.emptyMap(),
              Map.of("Cache-Control", "no-cache, no-store", "Accept-Encoding", "identity"),
              null,
              null)) {
        JSONObject existing =
            new JSONObject(new String(response.read(131072), StandardCharsets.UTF_8));
        JSONObject stored = existing.optJSONObject("item");
        if (!existing.optString("format").equals("life-atlas-publication")
            || existing.optInt("version") != 1
            || stored == null
            || !R2Catalog.samePublication(stored, item)
            || !stored.optString("manifestUrl").equals(manifestUrl))
          throw new R2Exception("INTEGRITY_FAILED");
        return new JSONObject().put("item", stored).put("manifestKey", key);
      }
    }
  }

  private static String scope(R2Credentials c) {
    return R2Policy.digest((c.endpoint + "/" + c.bucket).getBytes(StandardCharsets.UTF_8));
  }

  static void remember(R2Repository repository, R2Credentials c, JSONObject prepared)
      throws Exception {
    repository.store.edit(
        state -> {
          JSONObject all = state.optJSONObject("publications");
          if (all == null) {
            all = new JSONObject();
            state.put("publications", all);
          }
          JSONObject own = all.optJSONObject(scope(c));
          if (own == null) {
            own = new JSONObject();
            all.put(scope(c), own);
          }
          JSONObject item = prepared.getJSONObject("item"),
              old = own.optJSONObject(item.getString("id"));
          if (old == null && own.length() >= 5000) throw new R2Exception("CATALOG_LIMIT_REACHED");
          JSONArray keys = old == null ? new JSONArray() : old.getJSONArray("manifestKeys");
          boolean found = false;
          for (int i = 0; i < keys.length(); i++)
            if (keys.getString(i).equals(prepared.getString("manifestKey"))) found = true;
          if (!found) keys.put(prepared.getString("manifestKey"));
          own.put(
              item.getString("id"), new JSONObject().put("item", item).put("manifestKeys", keys));
        });
  }

  private static JSONObject records(R2Repository repository, R2Credentials c) throws Exception {
    JSONObject all = repository.store.snapshot().optJSONObject("publications");
    JSONObject own = all == null ? null : all.optJSONObject(scope(c));
    return own == null ? new JSONObject() : own;
  }

  static JSONObject merge(R2Repository repository, R2Credentials c, JSONObject legacy)
      throws Exception {
    LinkedHashMap<String, JSONObject> items = new LinkedHashMap<>();
    JSONArray previous = legacy.getJSONArray("items");
    for (int i = 0; i < previous.length(); i++)
      items.put(previous.getJSONObject(i).getString("id"), previous.getJSONObject(i));
    JSONObject own = records(repository, c);
    Iterator<String> ids = own.keys();
    while (ids.hasNext()) {
      JSONObject item = own.getJSONObject(ids.next()).getJSONObject("item");
      items.put(item.getString("id"), item);
    }
    if (items.size() > 5000) throw new R2Exception("CATALOG_LIMIT_REACHED");
    return new JSONObject(legacy.toString())
        .put("items", new JSONArray(items.values()))
        .put("includesDevicePublications", own.length() > 0);
  }

  static boolean references(R2Repository repository, R2Credentials c, String key) throws Exception {
    JSONObject own = records(repository, c);
    Iterator<String> ids = own.keys();
    while (ids.hasNext()) {
      JSONObject item = own.getJSONObject(ids.next()).getJSONObject("item");
      if (item.optString("key").equals(key)
          || item.optString("thumbnailUrl").equals(c.base + "/" + key)) return true;
    }
    return false;
  }

  static JSONObject unpublish(R2Repository repository, R2Credentials c, String id)
      throws Exception {
    return unpublish(repository, c, id, new R2Client(c));
  }

  static JSONObject unpublish(
      R2Repository repository, R2Credentials c, String id, R2Transport client) throws Exception {
    JSONObject own = records(repository, c), record = own.optJSONObject(id);
    R2Catalog legacy = new R2Catalog(c, client);
    if (record == null) {
      JSONObject current = legacy.read();
      JSONArray items = current.getJSONArray("items");
      for (int i = 0; i < items.length(); i++)
        if (items.getJSONObject(i).getString("id").equals(id)
            && references(repository, c, items.getJSONObject(i).getString("key")))
          return merge(repository, c, legacy.unpublishMetadata(id));
      return merge(repository, c, legacy.unpublish(id));
    }
    JSONObject current = legacy.read(), item = record.getJSONObject("item");
    JSONArray entries = current.getJSONArray("items");
    boolean legacyId = false;
    for (int i = 0; i < entries.length(); i++)
      if (entries.getJSONObject(i).getString("id").equals(id)) legacyId = true;
    if (legacyId) current = legacy.unpublishMetadata(id);
    boolean referenced = false;
    entries = current.getJSONArray("items");
    for (int i = 0; i < entries.length(); i++)
      if (entries.getJSONObject(i).optString("key").equals(item.getString("key")))
        referenced = true;
    Iterator<String> ids = own.keys();
    while (ids.hasNext()) {
      String other = ids.next();
      if (!other.equals(id)
          && own.getJSONObject(other)
              .getJSONObject("item")
              .optString("key")
              .equals(item.getString("key"))) referenced = true;
    }
    try {
      JSONArray keys = record.getJSONArray("manifestKeys");
      for (int i = 0; i < keys.length(); i++) client.delete(R2Policy.key(keys.getString(i)));
      if (!referenced) {
        client.delete(R2Policy.key(item.getString("key")));
        String preview = "galleries/previews/" + id + ".jpg";
        if (item.optString("thumbnailUrl").equals(c.base + "/" + preview)) client.delete(preview);
      }
    } catch (Exception error) {
      throw new R2Exception("PUBLIC_COPY_DELETE_FAILED");
    }
    repository.store.edit(
        state -> state.getJSONObject("publications").getJSONObject(scope(c)).remove(id));
    return merge(repository, c, current);
  }
}
