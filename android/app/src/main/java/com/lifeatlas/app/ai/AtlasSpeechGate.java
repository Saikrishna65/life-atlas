package com.lifeatlas.app.ai;

import java.util.*;

/** Sentence buffer for plain chat only. Suppresses structured output and reasoning blocks. */
public final class AtlasSpeechGate {
  private final StringBuilder pending = new StringBuilder();
  private boolean thinking = false, blocked = false;

  public synchronized List<String> append(String token, boolean finish) {
    if (blocked) return Collections.emptyList();
    pending.append(token);
    List<String> ready = new ArrayList<>();
    if (pending.length() > 16000) {
      blocked = true;
      return ready;
    }
    String lead = pending.toString().trim();
    if (!thinking && (lead.startsWith("{") || lead.startsWith("[") || lead.startsWith("```"))) {
      blocked = true;
      return ready;
    }
    while (true) {
      String value = pending.toString();
      if (thinking) {
        int end = value.indexOf("</think>");
        if (end < 0) {
          if (value.length() > 16) pending.delete(0, value.length() - 16);
          break;
        }
        pending.delete(0, end + 8);
        thinking = false;
        continue;
      }
      int thought = value.indexOf("<think>");
      if (thought >= 0) {
        pending.delete(0, thought + 7);
        thinking = true;
        continue;
      }
      int boundary = -1;
      for (int i = 0; i < value.length(); i++) {
        char c = value.charAt(i);
        if ((c == '.' || c == '!' || c == '?' || c == '\n')
            && (i + 1 < value.length() && Character.isWhitespace(value.charAt(i + 1))
                || finish && i + 1 == value.length())) {
          boundary = i + 1;
          break;
        }
      }
      if (boundary < 0) {
        if (finish && !value.contains("<")) {
          boundary = value.length();
        } else break;
      }
      if (boundary == 0) break;
      String sentence = value.substring(0, boundary).trim();
      pending.delete(0, boundary);
      if (!sentence.isEmpty()
          && !sentence.contains("<")
          && !sentence.contains("}")
          && !sentence.contains("{")
          && !sentence.matches(
              "(?is).*(?:I've|I have|I just|Successfully)"
                  + " (?:deleted|sent|published|saved|paid|transferred).*"))
        ready.add(sentence.replaceAll("[`*_#]", ""));
    }
    return ready;
  }
}
