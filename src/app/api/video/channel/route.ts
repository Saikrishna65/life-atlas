import { NextResponse } from "next/server";
import { readChannelId } from "@/lib/video/channel";
import { readContinuation, type SearchContinuation } from "@/lib/video/pagination";
import { browseChannel } from "@/lib/video/server-channel";
export const runtime = "nodejs";
export const maxDuration = 20;
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
  let id: string, continuation: SearchContinuation | undefined;
  try {
    const text = await request.text();
    if (text.length > 20000) return NextResponse.json({ error: "Request too large." }, { status: 413, headers });
    const body = JSON.parse(text), parsed = readChannelId(body.channelId);
    if (!parsed) throw Error("Invalid channel");
    id = parsed;
    if (body.continuation != null) {
      const cursor = readContinuation(body.continuation);
      if (!cursor) throw Error("Invalid page");
      continuation = cursor;
    }
  } catch { return NextResponse.json({ error: "Choose a valid channel." }, { status: 400, headers }); }
  try {
    const data = await browseChannel(id, AbortSignal.any([request.signal, AbortSignal.timeout(15000)]), undefined, continuation);
    return NextResponse.json(data, { headers });
  } catch { return NextResponse.json({ error: "This channel couldn’t load. Please try again." }, { status: 503, headers }); }
}
