package com.lifeatlas.app.r2;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import org.json.*;

/**
 * Immutable revisions + conditional current document. A racing publisher cannot silently overwrite
 * another.
 */
public final class R2Catalog {
  public static final String CURRENT = "atlas/catalog/current.json";
  private final R2Credentials credentials;
  private final R2Transport client;
  private static final int MAX_ATTEMPTS = 4;
  private static final java.util.concurrent.ConcurrentHashMap<String, Object> LOCKS =
      new java.util.concurrent.ConcurrentHashMap<>();
  private final Object mutationLock;
  private String etag = "";

  public R2Catalog(R2Credentials credentials) {
    this(credentials, new R2Client(credentials));
  }

  R2Catalog(R2Credentials credentials, R2Transport client) {
    this.credentials = credentials;
    this.client = client;
    mutationLock =
        LOCKS.computeIfAbsent(credentials.endpoint + "/" + credentials.bucket, key -> new Object());
  }

  public JSONObject read() throws Exception {
    try (R2Client.Response response =
        client.request(
            "GET",
            CURRENT,
            Collections.emptyMap(),
            Map.of("Cache-Control", "no-cache, no-store", "Pragma", "no-cache"),
            null,
            null)) {
      JSONObject catalog =
          new JSONObject(new String(response.read(2 * 1024 * 1024), StandardCharsets.UTF_8));
      if (!catalog.optString("format").equals("life-atlas-public-media")
          || catalog.optInt("version") != 1
          || catalog.getJSONArray("items").length() > 5000)
        throw new R2Exception("INVALID_PUBLIC_CATALOG");
      etag = response.header("ETag");
      if (etag.isEmpty()) throw new R2Exception("MISSING_CATALOG_ETAG");
      return catalog;
    } catch (R2Exception e) {
      if (!e.code.equals("OBJECT_NOT_FOUND")) throw e;
      etag = "";
      return new JSONObject()
          .put("format", "life-atlas-public-media")
          .put("version", 1)
          .put("revision", "")
          .put("updatedAt", Instant.now().toString())
          .put("items", new JSONArray());
    }
  }

  private JSONObject write(JSONObject catalog) throws Exception {
    if (credentials.base.isEmpty()) throw new R2Exception("PUBLIC_BASE_URL_REQUIRED");
    String revision = UUID.randomUUID().toString();
    catalog.put("revision", revision).put("updatedAt", Instant.now().toString());
    byte[] bytes = catalog.toString().getBytes(StandardCharsets.UTF_8);
    if (bytes.length > 2 * 1024 * 1024 || catalog.getJSONArray("items").length() > 5000)
      throw new R2Exception("CATALOG_LIMIT_REACHED");
    Map<String, String> headers = new LinkedHashMap<>();
    headers.put("Content-Type", "application/json; charset=utf-8");
    headers.put("Cache-Control", "public, max-age=31536000, immutable");
    headers.put("If-None-Match", "*");
    try (R2Client.Response ignored =
        client.request(
            "PUT",
            "atlas/catalog/revisions/" + revision + ".json",
            Collections.emptyMap(),
            headers,
            R2Client.bytes(bytes),
            null)) {}
    headers.remove("If-None-Match");
    headers.put(etag.isEmpty() ? "If-None-Match" : "If-Match", etag.isEmpty() ? "*" : etag);
    headers.put("Cache-Control", "public, max-age=30, must-revalidate");
    try (R2Client.Response ignored =
        client.request(
            "PUT", CURRENT, Collections.emptyMap(), headers, R2Client.bytes(bytes), null)) {}
    return catalog;
  }

  public JSONObject publish(JSONObject job, JSONObject input) throws Exception {
    if (!job.getString("slot").equals("public")
        || !job.getString("status").equals("complete")
        || !job.optBoolean("verified")
        || !job.optString("direction").equals("upload"))
      throw new R2Exception("VERIFIED_PUBLIC_COPY_REQUIRED");
    if (!Set.of(
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/avif",
            "image/gif",
            "image/heic",
            "image/heif",
            "video/mp4",
            "video/webm",
            "video/quicktime")
        .contains(job.getString("mimeType")))
      throw new R2Exception("PUBLIC_PREVIEW_FORMAT_UNSUPPORTED");
    if (!input.optBoolean("acknowledgeMetadata"))
      throw new R2Exception("PUBLIC_DISCLOSURE_REQUIRED");
    String title = input.optString("title").trim(),
        description = input.optString("description"),
        collection = input.optString("collection").trim(),
        category = input.optString("category");
    if (title.isEmpty()
        || title.length() > 140
        || description.length() > 2000
        || collection.length() > 140
        || !Set.of(
                "destination",
                "expedition",
                "gallery",
                "memory",
                "cinematic",
                "music-artwork",
                "atlas-visual")
            .contains(category)) throw new R2Exception("INVALID_PUBLIC_METADATA");
    JSONArray tags = input.optJSONArray("tags");
    if (tags == null) tags = new JSONArray();
    if (tags.length() > 16) throw new R2Exception("INVALID_PUBLIC_METADATA");
    for (int i = 0; i < tags.length(); i++)
      if (tags.getString(i).length() > 60) throw new R2Exception("INVALID_PUBLIC_METADATA");
    JSONObject remote = client.head(job.getString("key"));
    if (!remote.optString("sha256").equals(job.getString("sha256"))
        || remote.getLong("size") != job.getLong("totalBytes"))
      throw new R2Exception("INTEGRITY_FAILED");
    JSONObject item =
        new JSONObject()
            .put("id", job.getString("id"))
            .put("key", job.getString("key"))
            .put("url", credentials.base + "/" + R2Policy.path(job.getString("key")))
            .put("title", title)
            .put("description", description)
            .put("tags", tags)
            .put("category", category)
            .put("collection", collection)
            .put("mimeType", job.getString("mimeType"))
            .put("size", job.getLong("totalBytes"))
            .put("publishedAt", Instant.now().toString())
            .put("metadataPolicy", job.optBoolean("stripMetadata") ? "removed" : "retained");
    if (!job.optString("thumbnailKey").isEmpty())
      item.put(
          "thumbnailUrl", credentials.base + "/" + R2Policy.path(job.getString("thumbnailKey")));
    synchronized (mutationLock) {
      for (int attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        // Every attempt starts with the latest document and its own strong ETag.
        JSONObject catalog = read();
        JSONArray previous = catalog.getJSONArray("items"), items = new JSONArray();
        for (int i = 0; i < previous.length(); i++) {
          JSONObject existing = previous.getJSONObject(i);
          if (existing.getString("id").equals(job.getString("id"))) {
            if (samePublication(existing, item)) return catalog;
            if (existing.optString("key").equals(item.getString("key"))
                && existing.has("publishedAt"))
              item.put("publishedAt", existing.getString("publishedAt"));
          } else items.put(existing);
        }
        items.put(item);
        catalog.put("items", items);
        try {
          return write(catalog);
        } catch (R2Exception error) {
          if (!error.code.equals("CATALOG_CONFLICT") || attempt == MAX_ATTEMPTS - 1) throw error;
          try {
            Thread.sleep(50L << attempt);
          } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            throw new R2Exception("TRANSFER_INTERRUPTED");
          }
        }
      }
    }
    throw new R2Exception("CATALOG_CONFLICT");
  }

  private static boolean samePublication(JSONObject existing, JSONObject item) {
    // A lost response followed by Retry must not add a duplicate or a new revision.
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
          "metadataPolicy",
          "thumbnailUrl"
        }) if (!existing.optString(field).equals(item.optString(field))) return false;
    return existing.optLong("size") == item.optLong("size")
        && existing.optJSONArray("tags") != null
        && existing.optJSONArray("tags").toString().equals(item.optJSONArray("tags").toString());
  }

  public JSONObject unpublish(String id) throws Exception {
    synchronized (mutationLock) {
      return unpublishLocked(id);
    }
  }

  private JSONObject unpublishLocked(String id) throws Exception {
    JSONObject catalog = read(), removed = null;
    JSONArray previous = catalog.getJSONArray("items"), items = new JSONArray();
    for (int i = 0; i < previous.length(); i++) {
      JSONObject item = previous.getJSONObject(i);
      if (item.getString("id").equals(id)) removed = item;
      else items.put(item);
    }
    if (removed == null) throw new R2Exception("PUBLICATION_NOT_FOUND");
    catalog.put("items", items);
    write(catalog);
    String key = removed.getString("key");
    boolean referenced = false;
    for (int i = 0; i < items.length(); i++)
      if (items.getJSONObject(i).getString("key").equals(key)) referenced = true;
    if (!referenced)
      try {
        client.delete(R2Policy.key(key));
      } catch (Exception e) {
        throw new R2Exception("PUBLIC_COPY_DELETE_FAILED");
      }
    String previewKey = "galleries/previews/" + removed.getString("id") + ".jpg";
    if (removed.optString("thumbnailUrl").equals(credentials.base + "/" + previewKey)) {
      boolean previewReferenced = false;
      for (int i = 0; i < items.length(); i++)
        if (items
            .getJSONObject(i)
            .optString("thumbnailUrl")
            .equals(removed.optString("thumbnailUrl"))) previewReferenced = true;
      if (!previewReferenced)
        try {
          client.delete(previewKey);
        } catch (Exception e) {
          throw new R2Exception("PUBLIC_COPY_DELETE_FAILED");
        }
    }
    return catalog;
  }

  public boolean references(String key) throws Exception {
    JSONArray items = read().getJSONArray("items");
    for (int i = 0; i < items.length(); i++)
      if (items.getJSONObject(i).getString("key").equals(key)) return true;
    return false;
  }

  public String url() {
    return credentials.base.isEmpty() ? "" : credentials.base + "/" + CURRENT;
  }

  public JSONObject result(JSONObject catalog) throws Exception {
    return new JSONObject()
        .put("catalog", catalog)
        .put("catalogUrl", url())
        .put(
            "websiteUrl",
            url().isEmpty()
                ? ""
                : "https://life-atlas-eight-five.vercel.app/?atlasCatalog="
                    + R2Policy.encoded(url())
                    + "#published");
  }
}
