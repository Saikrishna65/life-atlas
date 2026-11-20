package com.lifeatlas.app.r2;

import java.util.*;
import org.json.*;

/** Anchor-based grouping avoids chaining a whole walking route into a 'duplicate' set. */
final class GallerySimilar {
  static final class Group {
    final List<GalleryIndexedPhotos.Photo> photos = new ArrayList<>();
    String key, best, pick;
    long date;

    Group(GalleryIndexedPhotos.Photo p) {
      photos.add(p);
      date = p.time;
    }
  }

  static final class Node {
    final Group group;
    final Map<Integer, Node> children = new TreeMap<>();

    Node(Group group) {
      this.group = group;
    }
  }

  final List<Group> groups = new ArrayList<>();
  final boolean partial;

  GallerySimilar(GalleryIndexedPhotos index, JSONObject choices) throws Exception {
    partial = index.partial;
    Set<String> excluded = new HashSet<>();
    JSONArray ignore = choices.optJSONArray("excluded");
    if (ignore != null) for (int i = 0; i < ignore.length(); i++) excluded.add(ignore.getString(i));
    List<Group> all = new ArrayList<>();
    Node root = null;
    for (GalleryIndexedPhotos.Photo p : index.photos) {
      if (p.quality == null
          || !GalleryPhotoQuality.VERSION.equals(p.quality.optString("version"))
          || excluded.contains(p.id + "|" + p.stamp)) continue;
      if (p.quality.optDouble("sharpness") < 3) continue;
      Group selected = null;
      int bestDistance = 11, visited = 0;
      Deque<Node> stack = new ArrayDeque<>();
      if (root != null) stack.push(root);
      while (!stack.isEmpty() && visited++ < 2048) {
        Node n = stack.pop();
        GalleryIndexedPhotos.Photo anchor = n.group.photos.get(0);
        int d = GalleryPhotoQuality.distance(p.quality, anchor.quality);
        if (d <= bestDistance
            && GalleryPhotoQuality.similar(p.quality, anchor.quality, p.time, anchor.time)) {
          selected = n.group;
          bestDistance = d;
        }
        for (Map.Entry<Integer, Node> e : n.children.entrySet())
          if (e.getKey() >= d - 10 && e.getKey() <= d + 10) stack.push(e.getValue());
      }
      if (selected != null) {
        selected.photos.add(p);
        selected.date = Math.max(selected.date, p.time);
      } else {
        Group g = new Group(p);
        all.add(g);
        Node node = new Node(g);
        if (root == null) root = node;
        else {
          Node parent = root;
          while (true) {
            int distance =
                GalleryPhotoQuality.distance(p.quality, parent.group.photos.get(0).quality);
            Node child = parent.children.get(distance);
            if (child == null) {
              parent.children.put(distance, node);
              break;
            }
            parent = child;
          }
        }
      }
    }
    Set<String> hidden = new HashSet<>();
    JSONArray h = choices.optJSONArray("hidden");
    if (h != null) for (int i = 0; i < h.length(); i++) hidden.add(h.getString(i));
    JSONObject picks = choices.optJSONObject("picks");
    for (Group g : all) {
      if (g.photos.size() < 2) continue;
      List<String> keys = new ArrayList<>();
      for (GalleryIndexedPhotos.Photo p : g.photos) keys.add(p.id + "|" + p.stamp);
      Collections.sort(keys);
      g.key = "similar:" + GallerySearchStore.token(String.join("\n", keys));
      if (hidden.contains(g.key)) continue;
      g.best =
          g.photos.stream()
              .max(Comparator.comparingDouble(p -> p.quality.optDouble("score")))
              .orElseThrow()
              .id;
      String saved = picks == null ? "" : picks.optString(g.key);
      g.pick = g.photos.stream().anyMatch(p -> p.id.equals(saved)) ? saved : "";
      JSONObject sourcePicks = choices.optJSONObject("sourcePicks");
      if (sourcePicks != null) {
        long latest = -1;
        for (GalleryIndexedPhotos.Photo p : g.photos) {
          long chosen = sourcePicks.optLong(p.id + "|" + p.stamp, -1);
          if (chosen > latest) {
            latest = chosen;
            g.pick = p.id;
          }
        }
      }
      groups.add(g);
    }
    groups.sort(Comparator.comparingLong((Group g) -> -g.date).thenComparing(g -> g.key));
  }

  Group group(String key) throws Exception {
    return groups.stream()
        .filter(g -> g.key.equals(key))
        .findFirst()
        .orElseThrow(() -> new R2Exception("GALLERY_COLLECTION_CHANGED"));
  }

  List<JSONObject> summaries() throws Exception {
    List<JSONObject> rows = new ArrayList<>();
    for (Group g : groups)
      rows.add(
          new JSONObject()
              .put("id", g.key)
              .put("kind", "similar")
              .put("title", g.photos.size() + " similar photos")
              .put("subtitle", "Review the suggested pick")
              .put("count", g.photos.size())
              .put("coverId", g.pick.isEmpty() ? g.best : g.pick)
              .put("bestId", g.best)
              .put("pickedId", g.pick));
    return rows;
  }

  static void edit(JSONObject choices, Group g, String action, String mediaId) throws Exception {
    if (action.equals("dismiss-similar")) {
      JSONArray hidden = choices.optJSONArray("hidden");
      if (hidden == null) {
        hidden = new JSONArray();
        choices.put("hidden", hidden);
      }
      hidden.put(g.key);
      return;
    }
    GalleryIndexedPhotos.Photo p =
        g.photos.stream()
            .filter(v -> v.id.equals(mediaId))
            .findFirst()
            .orElseThrow(() -> new R2Exception("INVALID_SELECTION"));
    if (action.equals("pick")) {
      JSONObject picks = choices.optJSONObject("picks");
      if (picks == null) {
        picks = new JSONObject();
        choices.put("picks", picks);
      }
      picks.put(g.key, p.id);
      JSONObject sourcePicks = choices.optJSONObject("sourcePicks");
      if (sourcePicks == null) {
        sourcePicks = new JSONObject();
        choices.put("sourcePicks", sourcePicks);
      }
      for (GalleryIndexedPhotos.Photo member : g.photos)
        sourcePicks.remove(member.id + "|" + member.stamp);
      sourcePicks.put(p.id + "|" + p.stamp, System.currentTimeMillis());
    } else if (action.equals("separate-photo")) {
      JSONArray excluded = choices.optJSONArray("excluded");
      if (excluded == null) {
        excluded = new JSONArray();
        choices.put("excluded", excluded);
      }
      excluded.put(p.id + "|" + p.stamp);
    } else throw new R2Exception("INVALID_SELECTION");
  }
}
