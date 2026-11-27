import { NextResponse } from "next/server";
import { readContinuation, type SearchContinuation } from "@/lib/video/pagination";
import { searchVideos } from "@/lib/video/server-search";
import { searchQuery } from "@/lib/video/search";
export const runtime = "nodejs";
export const maxDuration = 20;
export async function POST(request: Request) {
  const headers = {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
  let query: string;
  let continuation: SearchContinuation | undefined;
  try {
    // Avoid storing search text in URLs/access-log query strings. No application history/cache.
    const text = await request.text();
    if (text.length > 20000)
      return NextResponse.json(
        { error: "Search is too long." },
        { status: 413, headers },
      );
    const body = JSON.parse(text);
    query = searchQuery(body.query);
    if (body.continuation != null) {
      const parsed = readContinuation(body.continuation);
      if (!parsed) throw Error("Invalid continuation");
      continuation = parsed;
    }
  } catch {
    return NextResponse.json(
      { error: "Enter a search of up to 120 characters." },
      { status: 400, headers },
    );
  }
  try {
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(10000)]);
    const { videos, continuation: nextPage, setupMs, searchMs } = await searchVideos(query, signal, undefined, continuation);
    return NextResponse.json({ videos, continuation: nextPage }, {
      headers: { ...headers, "Server-Timing": `setup;dur=${setupMs.toFixed(1)}, search;dur=${searchMs.toFixed(1)}` },
    });
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
