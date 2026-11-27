import { test } from "node:test";
import assert from "node:assert/strict";
import { readChannel, readChannelId } from "../../src/lib/video/channel";
import { readVideoPage } from "../../src/lib/video/pagination";
import { browseChannel } from "../../src/lib/video/server-channel";
import { searchVideos } from "../../src/lib/video/server-search";
import { POST } from "../../src/app/api/video/channel/route";
const channelId = "UC" + "a".repeat(22);
const video = (i: number) => ({ videoRenderer: { videoId: `fixture${String(i).padStart(4, "0")}`, title: { simpleText: `Video ${i}` }, ownerText: { runs: [{ text: "Creator", navigationEndpoint: { browseEndpoint: { browseId: channelId } } }] }, thumbnail: { thumbnails: [] }, lengthText: { simpleText: "2:00" } } });
const endpoint = (tab: string) => ({ commandMetadata: { webCommandMetadata: { url: `/channel/${channelId}/${tab}`, apiUrl: "/youtubei/v1/browse" } }, browseEndpoint: { browseId: channelId, params: tab } });
const cursor = { continuationItemRenderer: { trigger: "CONTINUATION_TRIGGER_ON_ITEM_SHOWN", continuationEndpoint: { commandMetadata: { webCommandMetadata: { apiUrl: "/youtubei/v1/browse" } }, continuationCommand: { token: "channel-next" } } } };
function channelPage(videos: boolean) {
  return { metadata: { channelMetadataRenderer: { title: "Creator", description: "Real channel description", externalId: channelId, avatar: { thumbnails: [{ url: "https://yt3.ggpht.com/avatar", width: 88, height: 88 }] } } }, contents: { twoColumnBrowseResultsRenderer: { tabs: [
    { tabRenderer: { title: "Home", selected: !videos, endpoint: endpoint("featured"), content: !videos ? { sectionListRenderer: { contents: [] } } : undefined } },
    { tabRenderer: { title: "Videos", selected: videos, endpoint: endpoint("videos"), content: videos ? { richGridRenderer: { contents: [{ richItemRenderer: { content: video(0) } }, cursor] } } : undefined } },
  ] } } };
}
test("channel IDs and public avatar URLs are validated without importing arbitrary paths or history", () => {
  assert.equal(readChannelId(channelId), channelId);
  for (const value of [null, "Creator", "../channel", "https://youtube.com/channel/"+channelId, "UCshort"]) assert.equal(readChannelId(value), null);
  assert.equal(readChannel({ id: channelId, avatar: "https://evil.example/image" })?.avatar, undefined);
  assert.equal(readChannel({ id: channelId, avatar: "https://yt3.ggpht.com/image" })?.avatar, "https://yt3.ggpht.com/image");
  assert.equal(readVideoPage([{ id: "fixture0000", title: "Test", channelId }])[0].channelId, channelId);
  assert.equal(readVideoPage([{ id: "fixture0000", title: "Test", channelId: "bad" }])[0].channelId, undefined);
});
test("real SDK follows the Videos tab and continues the channel without repeating name-based searches", async () => {
  const calls: Record<string, unknown>[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const request = new Request(input, init), body = await request.json(); calls.push(body);
    assert.equal(new URL(request.url).pathname, "/youtubei/v1/browse");
    if (calls.length === 1) { assert.equal(body.browseId, channelId); return Response.json(channelPage(false)); }
    if (calls.length === 2) { assert.equal(body.params, "videos"); return Response.json(channelPage(true)); }
    assert.equal(body.continuation, "channel-next"); assert.equal(body.query, undefined);
    assert.deepEqual(body.context.client.visitorData, (calls[0].context as {client:{visitorData:string}}).client.visitorData);
    return Response.json({ onResponseReceivedActions: [{ appendContinuationItemsAction: { continuationItems: [{ richItemRenderer: { content: video(1) } }] } }] });
  };
  const first = await browseChannel(channelId, new AbortController().signal, fetcher);
  assert.equal(first.channel?.title, "Creator"); assert.equal(first.videos.length, 1); assert.equal(first.videos[0].channelId, channelId); assert.equal(first.continuation?.token, "channel-next");
  const second = await browseChannel(channelId, new AbortController().signal, fetcher, first.continuation!);
  assert.equal(second.videos[0].id, "fixture0001"); assert.equal(second.continuation, null); assert.equal(calls.length, 3);
});
test("search retains the provider's channel identity for creator navigation", async () => {
  const result = await searchVideos("nature", new AbortController().signal, async () => Response.json({ contents: { sectionListRenderer: { contents: [{ itemSectionRenderer: { contents: [video(0), { lockupViewModel: { contentId: "fixture0001", contentType: "LOCKUP_CONTENT_TYPE_VIDEO", metadata: { lockupMetadataViewModel: { title: { content: "Modern video" }, metadata: { contentMetadataViewModel: { metadataRows: [{ metadataParts: [{ text: { content: "Creator", commandRuns: [{ startIndex: 0, length: 7, onTap: { innertubeCommand: { browseEndpoint: { browseId: channelId } } } }] } }] }] } } } } } }] } }] } } }));
  assert.equal(result.videos[0].channelId, channelId); assert.equal(result.videos[1].channelId, channelId);
});
test("channel API rejects invalid IDs/cursors and oversized payloads before networking", async () => {
  for (const body of [{ channelId: "https://evil.example" }, { channelId, continuation: { token: "bad\nvalue" } }, null]) {
    const response = await POST(new Request("https://atlas.example/api/video/channel", { method: "POST", body: JSON.stringify(body) }));
    assert.equal(response.status, 400); assert.equal(response.headers.get("cache-control"), "no-store");
  }
  assert.equal((await POST(new Request("https://atlas.example/api/video/channel", { method: "POST", body: "x".repeat(20001) }))).status, 413);
});

test("channels without a Videos tab return their summary and an empty feed", async () => {
  const result = await browseChannel(channelId, new AbortController().signal, async () => Response.json({ metadata: { channelMetadataRenderer: { title: "Empty creator", externalId: channelId, avatar: { thumbnails: [] } } } }));
  assert.equal(result.channel?.title, "Empty creator"); assert.deepEqual(result.videos, []); assert.equal(result.continuation, null);
});
