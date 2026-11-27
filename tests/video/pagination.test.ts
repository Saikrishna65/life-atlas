import { test } from "node:test";
import assert from "node:assert/strict";
import { appendVideoPage, readContinuation, readVideoPage } from "../../src/lib/video/pagination";
import { searchVideos } from "../../src/lib/video/server-search";
import { POST } from "../../src/app/api/video/search/route";
const id = (index: number) => `fixture${String(index).padStart(4, "0")}`;
const node = (index: number) => ({ videoRenderer: { videoId: id(index), title: { simpleText: `Video ${index}` }, ownerText: { simpleText: "Test channel" }, thumbnail: { thumbnails: [] }, lengthText: { simpleText: "2:00" } } });
const next = { continuationItemRenderer: { trigger: "CONTINUATION_TRIGGER_ON_ITEM_SHOWN", continuationEndpoint: { commandMetadata: { webCommandMetadata: { apiUrl: "/youtubei/v1/search" } }, continuationCommand: { token: "page-two", request: "CONTINUATION_REQUEST_TYPE_SEARCH" } } } };
test("real SDK keeps the full first page and resumes with the provider token in exactly one request per page", async () => {
  let calls = 0;
  let visitor: string | undefined;
  const fetcher: typeof fetch = async (input, init) => {
    const request = new Request(input, init), body = await request.json();
    assert.equal(new URL(request.url).pathname, "/youtubei/v1/search");
    calls++;
    if (calls === 1) {
      assert.equal(body.query, "nature"); visitor = body.context.client.visitorData;
      return Response.json({ contents: { sectionListRenderer: { contents: [{ itemSectionRenderer: { contents: Array.from({ length: 30 }, (_, i) => node(i)) } }, next] } } });
    }
    assert.equal(body.query, undefined, "Continuation must not repeat page-one search");
    assert.equal(body.continuation, "page-two"); assert.equal(body.context.client.visitorData, visitor);
    return Response.json({ onResponseReceivedCommands: [{ appendContinuationItemsAction: { continuationItems: [{ itemSectionRenderer: { contents: [node(29), node(30)] } }] } }] });
  };
  const signal = new AbortController().signal;
  const first = await searchVideos("nature", signal, fetcher);
  assert.equal(first.videos.length, 30, "No artificial 24-result truncation");
  assert.equal(first.continuation?.token, "page-two"); assert.equal(first.continuation?.visitorData, visitor);
  const second = await searchVideos("nature", signal, fetcher, first.continuation!);
  assert.equal(calls, 2); assert.equal(second.continuation, null);
  assert.equal(appendVideoPage(first.videos, second.videos).length, 31, "Overlap between pages is deduplicated");
});
test("cursor validation bounds opaque data and never accepts paths/endpoints as configuration", () => {
  assert.deepEqual(readContinuation({ token: "abc%3D", visitorData: "anon_123", endpoint: "https://evil.example" }), { token: "abc%3D", visitorData: "anon_123" });
  for (const value of [null, [], "token", { token: "" }, { token: "bad\ntoken" }, { token: "x".repeat(16385) }, { token: "valid", visitorData: 5 }]) assert.equal(readContinuation(value), null);
});
test("client page handling keeps stable order, canonical thumbnail URLs and unique valid IDs", () => {
  const page = readVideoPage([{ id: id(0), title: "First", thumbnail: "javascript:bad" }, { id: id(0), title: "Duplicate" }, { id: "bad", title: "Invalid" }, { id: id(1), title: "Second" }]);
  assert.equal(page.length, 2); assert.equal(page[0].thumbnail, `https://i.ytimg.com/vi/${id(0)}/hqdefault.jpg`);
  const added = appendVideoPage(page, [...page, ...readVideoPage([{ id: id(2), title: "Third" }])]);
  assert.deepEqual(added.map((video) => video.id), [id(0), id(1), id(2)]); assert.equal(page.length, 2);
});
test("malformed continuation is rejected before any provider request", async () => {
  const result = await POST(new Request("https://atlas.example/api/video/search", { method: "POST", body: JSON.stringify({ query: "nature", continuation: { token: "bad\ntoken" } }) }));
  assert.equal(result.status, 400); assert.equal(result.headers.get("cache-control"), "no-store");
});
