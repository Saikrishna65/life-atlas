package com.lifeatlas.app.r2;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.util.*;
import java.util.regex.*;

/** OpenAI CLIP byte-level BPE, with the upstream MIT-licensed 48,894 merge vocabulary. */
final class GalleryClipTokenizer {
  private final Map<String, Integer> vocabulary = new HashMap<>(), ranks = new HashMap<>();
  private final String[] bytes = new String[256];
  private static final Pattern WORD =
      Pattern.compile(
          "<\\|startoftext\\|>|<\\|endoftext\\|>|'s|'t|'re|'ve|'m|'ll|'d|[\\p{L}]+|[\\p{N}]|[^\\s\\p{L}\\p{N}]+",
          Pattern.UNICODE_CHARACTER_CLASS);

  GalleryClipTokenizer(InputStream merges) throws IOException {
    List<Integer> values = new ArrayList<>();
    for (int i = 33; i <= 126; i++) values.add(i);
    for (int i = 161; i <= 172; i++) values.add(i);
    for (int i = 174; i <= 255; i++) values.add(i);
    int extra = 0;
    for (int i = 0; i < 256; i++)
      if (!values.contains(i)) {
        bytes[i] = new String(Character.toChars(256 + extra++));
      }
    for (int value : values) bytes[value] = new String(Character.toChars(value));
    List<String> ordered = new ArrayList<>();
    for (int value : values) ordered.add(bytes[value]);
    for (int i = 0; i < 256; i++) if (!values.contains(i)) ordered.add(bytes[i]);
    List<String> vocab = new ArrayList<>(ordered);
    for (String symbol : ordered) vocab.add(symbol + "</w>");
    try (BufferedReader reader =
        new BufferedReader(new InputStreamReader(merges, StandardCharsets.UTF_8))) {
      reader.readLine();
      String pair;
      while ((pair = reader.readLine()) != null && ranks.size() < 48894) {
        ranks.put(pair, ranks.size());
        vocab.add(pair.replace(" ", ""));
      }
    }
    if (ranks.size() != 48894) throw new IOException("SEARCH_MODEL_INVALID");
    vocab.add("<|startoftext|>");
    vocab.add("<|endoftext|>");
    for (int i = 0; i < vocab.size(); i++) vocabulary.put(vocab.get(i), i);
  }

  long[] encode(String input) {
    String clean =
        Normalizer.normalize(input, Normalizer.Form.NFC)
            .trim()
            .replaceAll("\\s+", " ")
            .toLowerCase(Locale.ROOT);
    List<Long> ids = new ArrayList<>();
    ids.add(49406L);
    Matcher matcher = WORD.matcher(clean);
    while (matcher.find() && ids.size() < 76) {
      String token = matcher.group();
      if (token.equals("<|startoftext|>") || token.equals("<|endoftext|>")) continue;
      StringBuilder encoded = new StringBuilder();
      for (byte value : token.getBytes(StandardCharsets.UTF_8)) encoded.append(bytes[value & 255]);
      List<String> pieces = new ArrayList<>();
      for (int code : encoded.toString().codePoints().toArray())
        pieces.add(new String(Character.toChars(code)));
      int last = pieces.size() - 1;
      pieces.set(last, pieces.get(last) + "</w>");
      while (pieces.size() > 1) {
        int best = Integer.MAX_VALUE;
        String pair = null;
        for (int i = 0; i < pieces.size() - 1; i++) {
          String candidate = pieces.get(i) + " " + pieces.get(i + 1);
          int rank = ranks.getOrDefault(candidate, Integer.MAX_VALUE);
          if (rank < best) {
            best = rank;
            pair = candidate;
          }
        }
        if (pair == null) break;
        List<String> joined = new ArrayList<>();
        for (int i = 0; i < pieces.size(); i++) {
          if (i + 1 < pieces.size() && pair.equals(pieces.get(i) + " " + pieces.get(i + 1)))
            joined.add(pieces.get(i++) + pieces.get(i));
          else joined.add(pieces.get(i));
        }
        pieces = joined;
      }
      for (String piece : pieces) {
        if (ids.size() == 76) break;
        ids.add((long) vocabulary.getOrDefault(piece, 49407));
      }
    }
    ids.add(49407L);
    long[] result = new long[ids.size()];
    for (int i = 0; i < result.length; i++) result[i] = ids.get(i);
    return result;
  }
}
