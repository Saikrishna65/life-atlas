import { parseSuggestionResponse, suggestionQuery } from "./suggestions";
/** One stateless request. No SDK/player initialization, cookies, logs or query/result cache. */
export async function getVideoSuggestions(value: unknown, signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<string[]> {
  const query = suggestionQuery(value);
  if (!query) return [];
  const url = new URL("https://suggestqueries.google.com/complete/search");
  url.searchParams.set("client", "firefox"); url.searchParams.set("ds", "yt");
  url.searchParams.set("hl", "en"); url.searchParams.set("q", query);
  const response = await fetcher(url, { signal, cache: "no-store", credentials: "omit", redirect: "error", headers: { Accept: "application/json" } });
  if (!response.ok || !response.body) throw Error("Suggestions unavailable");
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let text = "", bytes = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > 65536) { await reader.cancel(); throw Error("Suggestion response too large"); }
      text += decoder.decode(next.value, { stream: true });
    }
    text += decoder.decode();
    return parseSuggestionResponse(JSON.parse(text));
  } finally { reader.releaseLock(); }
}
