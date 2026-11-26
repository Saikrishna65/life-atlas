import { NextResponse } from "next/server";
import { searchQuery } from "@/lib/video/search";
export const runtime = "nodejs";
export const maxDuration = 20;
export async function POST(request: Request) {
  const headers = {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
  let query: string;
  try {
    // Avoid storing search text in URLs/access-log query strings. No application history/cache.
    const text = await request.text();
    if (text.length > 2048)
      return NextResponse.json(
        { error: "Search is too long." },
        { status: 413, headers },
      );
    query = searchQuery(JSON.parse(text).query);
  } catch {
    return NextResponse.json(
      { error: "Enter a search of up to 120 characters." },
      { status: 400, headers },
    );
  }
  try {
    const { Innertube, YTNodes } = await import("youtubei.js");
    const signal = AbortSignal.any([
      request.signal,
      AbortSignal.timeout(12000),
    ]);
    const yt = await Innertube.create({
      generate_session_locally: true,
      fetch: (url, init) => fetch(url, { ...init, signal, cache: "no-store" }),
    });
    const results = await yt.search(query, { type: "video" });
    // YouTube currently returns both classic Video and newer LockupView renderers.
    const videos = results.results
      .flatMap((node) => {
        if (node.is(YTNodes.Video)) {
          return [
            {
              id: node.video_id,
              title: node.title.toString(),
              channel: node.author.name || "",
              duration: node.duration.text || "",
            },
          ];
        }
        if (
          node.is(YTNodes.LockupView) &&
          node.content_type === "VIDEO" &&
          node.content_id
        ) {
          return [
            {
              id: node.content_id,
              title: node.metadata?.title?.toString() || "Video",
              channel:
                node.metadata?.metadata?.metadata_rows?.[0]?.metadata_parts?.[0]?.text?.toString() ||
                "",
              duration: node.duration.text || "",
            },
          ];
        }
        return [];
      })
      .filter((video) => /^[A-Za-z0-9_-]{11}$/.test(video.id))
      .slice(0, 24)
      .map((video) => ({
        ...video,
        thumbnail: `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`,
      }));
    return NextResponse.json({ videos }, { headers });
  } catch {
    return NextResponse.json(
      {
        error:
          "Video search is unavailable right now. You can still paste a YouTube video link to watch.",
      },
      { status: 503, headers },
    );
  }
}
