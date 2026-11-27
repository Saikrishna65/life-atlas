import { readChannel, readChannelId } from "./channel";
import { readContinuation, type SearchContinuation } from "./pagination";
import { SEARCH_SESSION_OPTIONS } from "./server-search";
import type { VideoResult } from "./search";
export async function browseChannel(id: string, signal: AbortSignal, fetcher: typeof fetch = fetch, continuation?: SearchContinuation) {
  if (!readChannelId(id)) throw Error("Invalid channel");
  const { Innertube, YTNodes, Mixins } = await import("youtubei.js");
  const yt = await Innertube.create({ ...SEARCH_SESSION_OPTIONS, visitor_data: continuation?.visitorData, fetch: (url, init) => fetcher(url, { ...init, signal, cache: "no-store" }) });
  const channel = continuation ? null : await yt.getChannel(id);
  // Ask the SDK for the channel's actual Videos tab, not a name-based search.
  const page = continuation ? new Mixins.Feed(yt.actions, await yt.actions.execute("/browse", { continuation: continuation.token, parse: true }), true) : channel!.has_videos ? await channel!.getVideos() : null;
  const summary = channel ? readChannel({ id, title: channel.metadata.title, description: channel.metadata.description, avatar: (channel.metadata.avatar || channel.metadata.thumbnail)?.[0]?.url }) : null;
  const videos: VideoResult[] = [], seen = new Set<string>();
  for (const node of page?.videos || []) {
    let item: VideoResult | undefined;
    if (node.is(YTNodes.Video, YTNodes.GridVideo)) {
      item = { id: node.video_id, title: node.title.toString(), channel: summary?.title || node.author?.name || "", channelId: id, duration: node.duration?.text || "", thumbnail: `https://i.ytimg.com/vi/${node.video_id}/hqdefault.jpg` };
    } else if (node.is(YTNodes.LockupView) && node.content_type === "VIDEO" && node.content_id) {
      item = { id: node.content_id, title: node.metadata?.title?.toString() || "Video", channel: summary?.title || "", channelId: id, duration: node.duration?.text || "", thumbnail: `https://i.ytimg.com/vi/${node.content_id}/hqdefault.jpg` };
    }
    if (item && /^[A-Za-z0-9_-]{11}$/.test(item.id) && !seen.has(item.id)) { seen.add(item.id); videos.push(item); }
  }
  const headerNodes = new Set<unknown>(page?.page.header_memo?.getType(YTNodes.ContinuationItem, YTNodes.ContinuationItemView) || []);
  const next = page?.has_continuation ? page.memo.getType(YTNodes.ContinuationItem, YTNodes.ContinuationItemView).find((item) => !headerNodes.has(item)) : undefined;
  return { channel: summary, videos, continuation: readContinuation({ token: next?.endpoint.payload.token ?? next?.endpoint.payload.continuation, visitorData: yt.session.context.client.visitorData }) };
}
