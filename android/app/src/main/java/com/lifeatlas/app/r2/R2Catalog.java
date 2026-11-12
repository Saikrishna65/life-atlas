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
  private final R2Client client;
  private String etag = "";

  public R2Catalog(R2Credentials credentials) {
    this.credentials = credentials;
    this.client = new R2Client(credentials);
  }

  public JSONObject read() throws Exception {
    try (R2Client.Response response =
        client.request(
            "GET", CURRENT, Collections.emptyMap(), Collections.emptyMap(), null, null)) {
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
    JSONObject catalog = read();
    JSONArray previous = catalog.getJSONArray("items"), items = new JSONArray();
    String id = job.getString("id");
    for (int i = 0; i < previous.length(); i++)
      if (!previous.getJSONObject(i).getString("id").equals(id))
        items.put(previous.getJSONObject(i));
    items.put(
        new JSONObject()
            .put("id", id)
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
            .put("metadataPolicy", job.optBoolean("stripMetadata") ? "removed" : "retained"));
    if (!job.optString("thumbnailKey").isEmpty())
      items
          .getJSONObject(items.length() - 1)
          .put(
              "thumbnailUrl",
              credentials.base + "/" + R2Policy.path(job.getString("thumbnailKey")));
    catalog.put("items", items);
    return write(catalog);
  }

  public JSONObject unpublish(String id) throws Exception {
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
