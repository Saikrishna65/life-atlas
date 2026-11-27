import { readContinuation, type SearchContinuation } from "./pagination";
import { readChannelId } from "./channel";
import type { VideoResult } from "./search";

/** Search never deciphers media. Fetching player JS/config adds round trips without helping results. */
export const SEARCH_SESSION_OPTIONS = Object.freeze({
  generate_session_locally: true,
  retrieve_player: false,
  retrieve_innertube_config: false,
  enable_session_cache: false,
});
export async function searchVideos(query: string, signal: AbortSignal, fetcher: typeof fetch = fetch, continuation?: SearchContinuation) {
  const start = performance.now();
  const { Innertube, YTNodes, Mixins, ReloadContinuationItemsCommand } = await import("youtubei.js");
  const yt = await Innertube.create({
    ...SEARCH_SESSION_OPTIONS,
    visitor_data: continuation?.visitorData,
    fetch: (url, init) => fetcher(url, { ...init, signal, cache: "no-store" }),
  });
  const ready = performance.now();
  const first = continuation ? null : await yt.search(query, { type: "video" });
  const continued = continuation ? new Mixins.Feed(yt.actions, await yt.actions.execute("/search", { continuation: continuation.token, parse: true }), true) : null;
  const results = first || continued!;
  // Search's header constructor expects reload commands; continuation batches can be append-only.
  // Use the SDK's generic parsed feed for those batches and retain their item order.
  const commands = [...(continued?.page.on_response_received_commands || []), ...(continued?.page.on_response_received_actions || []), ...(continued?.page.on_response_received_endpoints || [])];
  const appended = commands.flatMap((command) => command.is(YTNodes.AppendContinuationItemsAction, ReloadContinuationItemsCommand) ? [...(command.contents || [])] : []);
  const nodes = first?.results || appended.flatMap((node) => node.is(YTNodes.ItemSection) ? [...node.contents] : [node]);
  const videos: VideoResult[] = [];
  const ids = new Set<string>();
  for (const node of nodes.length ? nodes : results.videos) {
    let item: Omit<VideoResult, "thumbnail"> | undefined;
    if (node.is(YTNodes.Video)) {
      item = { id: node.video_id, title: node.title.toString(), channel: node.author.name || "", ...(readChannelId(node.author.id) ? { channelId: node.author.id } : {}), duration: node.duration.text || "" };
    } else if (node.is(YTNodes.LockupView) && node.content_type === "VIDEO" && node.content_id) {
      const author = node.metadata?.metadata?.metadata_rows?.[0]?.metadata_parts?.[0]?.text;
      const avatar = node.metadata?.image;
      const avatarId = avatar?.is(YTNodes.DecoratedAvatarView) ? readChannelId(avatar.renderer_context.command_context?.on_tap?.payload.browseId) : null;
      const channelId = avatarId || readChannelId(author?.endpoint?.payload.browseId) || readChannelId(author?.runs?.flatMap((run) => "endpoint" in run ? [run.endpoint?.payload.browseId] : []).find(readChannelId));
      item = { ...(channelId ? { channelId } : {}), id: node.content_id, title: node.metadata?.title?.toString() || "Video", channel: node.metadata?.metadata?.metadata_rows?.[0]?.metadata_parts?.[0]?.text?.toString() || "", duration: node.duration.text || "" };
    }
    if (!item || !/^[A-Za-z0-9_-]{11}$/.test(item.id) || ids.has(item.id)) continue;
    ids.add(item.id);
    videos.push({ ...item, thumbnail: `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg` });

  }
  const headers = new Set<unknown>(results.page.header_memo?.getType(YTNodes.ContinuationItem, YTNodes.ContinuationItemView) || []);
  const next = results.has_continuation ? results.memo.getType(YTNodes.ContinuationItem, YTNodes.ContinuationItemView).find((item) => !headers.has(item)) : undefined;
  const nextPage = readContinuation({ token: next?.endpoint.payload.token ?? next?.endpoint.payload.continuation, visitorData: yt.session.context.client.visitorData });
  return { videos, continuation: nextPage, setupMs: ready - start, searchMs: performance.now() - ready };
}
