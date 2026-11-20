package com.lifeatlas.app.r2;

import java.util.*;
import org.json.*;

/** Identity names always come from the owner. Unreviewed matches never join a named person. */
final class GalleryPeople {
  static final class Group {
    final String id;
    String name = "", suggestedPersonId = "";
    boolean confirmed;
    final List<GalleryIndexedPhotos.Face> faces = new ArrayList<>();
    final Set<String> photos = new LinkedHashSet<>();

    Group(String id) {
      this.id = id;
    }

    void add(GalleryIndexedPhotos.Face f) {
      faces.add(f);
      photos.add(f.mediaId);
    }

    String logical() {
      return !suggestedPersonId.isEmpty() ? suggestedPersonId : id;
    }
  }

  static final class Anchor {
    final GalleryIndexedPhotos.Face face;
    final Group group;

    Anchor(GalleryIndexedPhotos.Face f, Group g) {
      face = f;
      group = g;
    }
  }

  final List<Group> groups = new ArrayList<>();
  final Map<String, GalleryIndexedPhotos.Face> faces = new HashMap<>();
  private final Map<Integer, List<Anchor>> buckets = new HashMap<>();
  private final List<Anchor> allAnchors = new ArrayList<>();
  final boolean partial;

  GalleryPeople(GalleryIndexedPhotos index, JSONObject choices) throws Exception {
    partial = index.partial;
    JSONObject people = choices.optJSONObject("people"),
        assignments = choices.optJSONObject("assignments");
    Set<String> excluded = set(choices.optJSONArray("excluded")),
        separated = set(choices.optJSONArray("separated"));
    List<GalleryIndexedPhotos.Face> all = new ArrayList<>();
    for (GalleryIndexedPhotos.Photo p : index.photos)
      for (GalleryIndexedPhotos.Face f : p.faces)
        if (!excluded.contains(f.id)) {
          all.add(f);
          faces.put(f.id, f);
        }
    all.sort(
        Comparator.comparingLong((GalleryIndexedPhotos.Face f) -> f.time).thenComparing(f -> f.id));
    Map<String, Group> named = new LinkedHashMap<>();
    if (assignments != null)
      for (GalleryIndexedPhotos.Face f : all) {
        String person = assignments.optString(f.id);
        if (person.isEmpty() || people == null || !people.has(person)) continue;
        Group g = named.get(person);
        if (g == null) {
          g = new Group(person);
          g.name = people.getString(person);
          g.confirmed = true;
          named.put(person, g);
        }
        g.add(f);
      }
    groups.addAll(named.values());
    for (Group g : named.values())
      for (int i = 0; i < Math.min(8, g.faces.size()); i++) add(g.faces.get(i), g);
    for (GalleryIndexedPhotos.Face f : all) {
      if (assignments != null && named.containsKey(assignments.optString(f.id))) continue;
      if (separated.contains(f.id)) {
        Group solo = new Group("candidate:" + f.id);
        solo.add(f);
        groups.add(solo);
        continue;
      }
      List<Anchor> candidates = candidates(f);
      Map<String, Anchor> bestByGroup = new HashMap<>();
      Map<String, Double> scores = new HashMap<>();
      for (Anchor anchor : candidates) {
        if (anchor.group.photos.contains(f.mediaId)) continue;
        String logical = anchor.group.logical();
        double score = cosine(f.vector, anchor.face.vector);
        if (score > scores.getOrDefault(logical, -2d)) {
          scores.put(logical, score);
          bestByGroup.put(logical, anchor);
        }
      }
      List<String> matches = new ArrayList<>(scores.keySet());
      matches.sort(
          Comparator.comparingDouble((String id) -> -scores.get(id)).thenComparing(id -> id));
      double best = matches.isEmpty() ? -1 : scores.get(matches.get(0)),
          second = matches.size() < 2 ? -1 : scores.get(matches.get(1));
      Group chosen = null;
      if (best >= .62 && best - second >= .06) {
        Anchor a = bestByGroup.get(matches.get(0));
        if (!a.group.confirmed) chosen = a.group;
        else {
          Group proposal = new Group("candidate:" + f.id);
          proposal.suggestedPersonId = a.group.id;
          groups.add(proposal);
          chosen = proposal;
        }
      }
      if (chosen == null) {
        chosen = new Group("candidate:" + f.id);
        groups.add(chosen);
      }
      chosen.add(f);
      if (chosen.faces.size() <= 4) add(f, chosen);
    }
    groups.sort(
        Comparator.comparing((Group g) -> !g.confirmed)
            .thenComparing(
                g -> g.confirmed ? g.name.toLowerCase(Locale.ROOT) : "", Comparator.naturalOrder())
            .thenComparing(Comparator.comparingInt((Group g) -> g.photos.size()).reversed())
            .thenComparing(g -> g.id));
  }

  static Set<String> set(JSONArray array) throws Exception {
    Set<String> result = new HashSet<>();
    if (array != null) for (int i = 0; i < array.length(); i++) result.add(array.getString(i));
    return result;
  }

  static double cosine(float[] a, float[] b) {
    double sum = 0;
    for (int i = 0; i < 128; i++) sum += a[i] * b[i];
    return sum;
  }

  private void add(GalleryIndexedPhotos.Face f, Group g) {
    Anchor anchor = new Anchor(f, g);
    allAnchors.add(anchor);
    for (int band = 0; band < 8; band++)
      buckets
          .computeIfAbsent(
              (band << 4) | (int) ((f.hash >> (band * 4)) & 15), k -> new ArrayList<>())
          .add(anchor);
  }

  private List<Anchor> candidates(GalleryIndexedPhotos.Face f) {
    if (allAnchors.size() <= 256) return allAnchors;
    Set<Anchor> unique = new HashSet<>();
    for (int band = 0; band < 8; band++) {
      List<Anchor> bucket = buckets.get((band << 4) | (int) ((f.hash >> (band * 4)) & 15));
      if (bucket != null) {
        int n = 0;
        for (Anchor a : bucket) {
          unique.add(a);
          if (++n == 512) break;
        }
      }
    }
    List<Anchor> result = new ArrayList<>(unique);
    result.sort(
        Comparator.comparingInt((Anchor a) -> Long.bitCount(f.hash ^ a.face.hash))
            .thenComparing(a -> a.face.id));
    return result.size() > 96 ? result.subList(0, 96) : result;
  }

  Group group(String id) throws Exception {
    return groups.stream()
        .filter(g -> g.id.equals(id))
        .findFirst()
        .orElseThrow(() -> new R2Exception("GALLERY_COLLECTION_CHANGED"));
  }

  List<JSONObject> summaries() throws Exception {
    List<JSONObject> rows = new ArrayList<>();
    Map<String, String> names = new HashMap<>();
    for (Group g : groups) if (g.confirmed) names.put(g.id, g.name);
    for (Group g : groups) {
      String title =
          g.confirmed
              ? g.name
              : g.suggestedPersonId.isEmpty()
                  ? "Name this person"
                  : "Possibly " + names.getOrDefault(g.suggestedPersonId, "a person you named");
      rows.add(
          new JSONObject()
              .put("id", g.id)
              .put("kind", "people")
              .put("title", title)
              .put(
                  "subtitle",
                  g.confirmed ? "Name confirmed by you" : "Suggested group · please review")
              .put("confirmed", g.confirmed)
              .put("suggestedPersonId", g.suggestedPersonId)
              .put("count", g.photos.size())
              .put("faceId", g.faces.get(0).id)
              .put("coverId", g.faces.get(0).mediaId));
    }
    return rows;
  }

  static String name(String value) throws Exception {
    String v = value == null ? "" : value.trim().replaceAll("[\\p{Cntrl}]", " ");
    if (v.isEmpty() || v.length() > 80) throw new R2Exception("INVALID_PERSON_NAME");
    return v;
  }

  void edit(
      JSONObject choices, String action, String key, String faceId, String personId, String label)
      throws Exception {
    JSONObject people = choices.optJSONObject("people");
    if (people == null) {
      people = new JSONObject();
      choices.put("people", people);
    }
    JSONObject assignments = choices.optJSONObject("assignments");
    if (assignments == null) {
      assignments = new JSONObject();
      choices.put("assignments", assignments);
    }
    if (action.equals("name-person")) {
      Group g = group(key);
      String id = g.confirmed ? g.id : UUID.randomUUID().toString();
      people.put(id, name(label));
      for (GalleryIndexedPhotos.Face f : g.faces) assignments.put(f.id, id);
      return;
    }
    if (action.equals("confirm-person-match")) {
      Group g = group(key);
      if (personId.isEmpty() || !people.has(personId)) throw new R2Exception("INVALID_SELECTION");
      for (GalleryIndexedPhotos.Face f : g.faces) assignments.put(f.id, personId);
      return;
    }
    GalleryIndexedPhotos.Face f = faces.get(faceId);
    if (f == null) throw new R2Exception("GALLERY_COLLECTION_CHANGED");
    Group g = group(key);
    if (g.faces.stream().noneMatch(v -> v.id.equals(faceId)))
      throw new R2Exception("INVALID_SELECTION");
    if (action.equals("assign-face")) {
      if (!people.has(personId)) throw new R2Exception("INVALID_SELECTION");
      assignments.put(f.id, personId);
    } else if (action.equals("separate-face") || action.equals("exclude-face")) {
      assignments.remove(f.id);
      String field = action.equals("separate-face") ? "separated" : "excluded";
      Set<String> values = set(choices.optJSONArray(field));
      values.add(f.id);
      List<String> sorted = new ArrayList<>(values);
      Collections.sort(sorted);
      choices.put(field, new JSONArray(sorted));
    } else throw new R2Exception("INVALID_SELECTION");
  }

  static void forget(GallerySearchStore db) throws Exception {
    try (android.database.Cursor cursor = db.rows()) {
      while (cursor.moveToNext()) {
        JSONObject row = db.read(cursor.getString(0), cursor.getBlob(1));
        if (row.has("faces") || row.has("faceVersion")) {
          row.remove("faces");
          row.remove("faceVersion");
          db.put(row);
        }
      }
    }
    db.choice("people", new JSONObject());
  }
}
