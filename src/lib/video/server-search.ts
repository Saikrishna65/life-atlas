import type { VideoResult } from "./search";

/** Search never deciphers media. Fetching player JS/config adds round trips without helping results. */
export const SEARCH_SESSION_OPTIONS = Object.freeze({
  generate_session_locally: true,
  retrieve_player: false,
  retrieve_innertube_config: false,
  enable_session_cache: false,
});
export async function searchVideos(query: string, signal: AbortSignal, fetcher: typeof fetch = fetch) {
  const start = performance.now();
  const { Innertube, YTNodes } = await import("youtubei.js");
  const yt = await Innertube.create({
    ...SEARCH_SESSION_OPTIONS,
    fetch: (url, init) => fetcher(url, { ...init, signal, cache: "no-store" }),
  });
  const ready = performance.now();
  const results = await yt.search(query, { type: "video" });
  const videos: VideoResult[] = [];
  const ids = new Set<string>();
  for (const node of results.results) {
    let item: Omit<VideoResult, "thumbnail"> | undefined;
    if (node.is(YTNodes.Video)) {
      item = { id: node.video_id, title: node.title.toString(), channel: node.author.name || "", duration: node.duration.text || "" };
    } else if (node.is(YTNodes.LockupView) && node.content_type === "VIDEO" && node.content_id) {
      item = { id: node.content_id, title: node.metadata?.title?.toString() || "Video", channel: node.metadata?.metadata?.metadata_rows?.[0]?.metadata_parts?.[0]?.text?.toString() || "", duration: node.duration.text || "" };
    }
    if (!item || !/^[A-Za-z0-9_-]{11}$/.test(item.id) || ids.has(item.id)) continue;
    ids.add(item.id);
    videos.push({ ...item, thumbnail: `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg` });
    if (videos.length === 24) break;
  }
  return { videos, setupMs: ready - start, searchMs: performance.now() - ready };
}
