import { test } from "node:test";
import assert from "node:assert/strict";
import { searchVideos } from "../../src/lib/video/server-search";
const video = (id: string) => ({ videoRenderer: {
  videoId: id, title: { simpleText: "A real parser fixture" }, ownerText: { simpleText: "Fixture channel" },
  lengthText: { simpleText: "2:00" }, thumbnail: { thumbnails: [] },
} });
const response = { contents: { sectionListRenderer: { contents: [{ itemSectionRenderer: { contents: [video("dQw4w9WgXcQ"), video("dQw4w9WgXcQ"), video("invalid")] } }] } } };
test("real SDK performs one upstream search, without downloading config/player scripts or caching queries", async () => {
  const calls: string[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    calls.push(url.pathname);
    assert.equal(url.pathname, "/youtubei/v1/search", "Session setup must not request config, iframe_api or base.js");
    assert.equal(request.method, "POST");
    assert.equal(request.cache, "no-store");
    assert.equal((await request.json()).query, "mountains");
    return new Response(JSON.stringify(response), { headers: { "Content-Type": "application/json" } });
  };
  const first = await searchVideos("mountains", new AbortController().signal, fetcher);
  assert.equal(calls.length, 1);
  assert.equal(first.videos.length, 1, "Duplicate and invalid IDs are filtered");
  assert.equal(first.videos[0].channel, "Fixture channel");
  assert.equal(first.videos[0].duration, "2:00");
  assert.ok(first.setupMs >= 0 && first.searchMs >= 0);
  await searchVideos("mountains", new AbortController().signal, fetcher);
  assert.equal(calls.length, 2, "Search results are not cached or retained between requests");
});
test("request cancellation is isolated from other simultaneous search requests", async () => {
  const cancelled = new AbortController(); cancelled.abort(new Error("User cancelled"));
  const fetcher: typeof fetch = async (_input, init) => {
    if (init?.signal?.aborted) throw init.signal.reason;
    return new Response(JSON.stringify(response), { headers: { "Content-Type": "application/json" } });
  };
  const [first, second] = await Promise.allSettled([
    searchVideos("one", cancelled.signal, fetcher), searchVideos("two", new AbortController().signal, fetcher),
  ]);
  assert.equal(first.status, "rejected"); assert.equal(second.status, "fulfilled");
});
