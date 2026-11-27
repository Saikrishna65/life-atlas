import { test } from "node:test";
import assert from "node:assert/strict";
import { directVideoId, suggestionQuery, suggestionList, parseSuggestionResponse } from "../../src/lib/video/suggestions";
import { getVideoSuggestions } from "../../src/lib/video/server-suggestions";
import { POST } from "../../src/app/api/video/suggestions/route";
test("autocomplete accepts typed text but never automatically forwards URLs, IDs or invalid input", () => {
  assert.equal(suggestionQuery("  nature   films "), "nature films");
  assert.equal(suggestionQuery("a"), "a");
  assert.equal(suggestionQuery("documentary"), "documentary", "An eleven-letter word is a query, not a video ID");
  assert.equal(directVideoId("documentary"), null);
  assert.equal(directVideoId("DOCUMENTARY"), null);
  assert.equal(suggestionQuery("NatureFilms"), "NatureFilms");
  assert.equal(directVideoId("dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  for (const value of [null, {}, "", "  ", "x".repeat(121), "test\nquery", "https://private.example/photo", "www.example.com/secret", "https://youtu.be/dQw4w9WgXcQ", "dQw4w9WgXcQ", "javascript:hello", "watch https://youtu.be/dQw4w9WgXcQ"]) assert.equal(suggestionQuery(value), null, String(value));
});
test("provider suggestions are bounded, deduplicated plain text without executing markup/JSONP", () => {
  assert.deepEqual(parseSuggestionResponse(["nature", ["nature films", "NATURE FILMS", null, "  nature sounds  ", "", 42]]), ["nature films", "nature sounds"]);
  assert.deepEqual(suggestionList(["good", "bad\nentry", "x".repeat(121)]), ["good"]);
  assert.equal(suggestionList(Array.from({ length: 20 }, (_, i) => `word ${i}`)).length, 8);
  assert.deepEqual(parseSuggestionResponse({ suggestions: ["not the provider schema"] }), []);
});
test("server makes one cookieless uncached request to the fixed YouTube suggestion provider", async () => {
  let calls = 0;
  const signal = new AbortController().signal;
  const fetcher: typeof fetch = async (input, init) => {
    calls++;
    const url = new URL(String(input));
    assert.equal(url.origin, "https://suggestqueries.google.com");
    assert.equal(url.pathname, "/complete/search"); assert.equal(url.searchParams.get("client"), "firefox");
    assert.equal(url.searchParams.get("ds"), "yt"); assert.equal(url.searchParams.get("q"), "nature");
    assert.equal(init?.cache, "no-store"); assert.equal(init?.credentials, "omit"); assert.equal(init?.signal, signal);
    return Response.json(["nature", ["nature films", "nature sounds"]]);
  };
  assert.deepEqual(await getVideoSuggestions("nature", signal, fetcher), ["nature films", "nature sounds"]);
  assert.equal(calls, 1);
  await getVideoSuggestions("nature", signal, fetcher);
  assert.equal(calls, 2, "No cache/history is retained between requests");
  assert.deepEqual(await getVideoSuggestions("https://example.com/private", signal, fetcher), []);
  assert.equal(calls, 2);
});
test("oversized, malformed and failed provider responses are rejected without evaluating scripts", async () => {
  const signal = new AbortController().signal;
  for (const response of [new Response("x".repeat(65537)), new Response("callback([1])"), new Response("Forbidden", { status: 403 })]) {
    await assert.rejects(getVideoSuggestions("nature", signal, async () => response));
  }
});
test("suggestion endpoint uses POST bodies/no-store and gracefully fails without breaking search", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => { throw Error("Provider unavailable"); };
    const result = await POST(new Request("https://atlas.example/api/video/suggestions", { method: "POST", body: JSON.stringify({ query: "nature" }) }));
    assert.equal(result.status, 200); assert.equal(result.headers.get("cache-control"), "no-store");
    assert.deepEqual(await result.json(), { suggestions: [] });
    const invalid = await POST(new Request("https://atlas.example/api/video/suggestions", { method: "POST", body: "{" }));
    assert.equal(invalid.status, 400);
    const large = await POST(new Request("https://atlas.example/api/video/suggestions", { method: "POST", body: "x".repeat(2049) }));
    assert.equal(large.status, 413);
  } finally { globalThis.fetch = original; }
});
