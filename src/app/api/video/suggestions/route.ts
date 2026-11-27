import { NextResponse } from "next/server";
import { getVideoSuggestions } from "@/lib/video/server-suggestions";
export const runtime = "nodejs";
export const maxDuration = 10;
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
  let value: unknown;
  try {
    const text = await request.text();
    if (text.length > 2048) return NextResponse.json({ suggestions: [] }, { status: 413, headers });
    value = JSON.parse(text).query;
  } catch { return NextResponse.json({ suggestions: [] }, { status: 400, headers }); }
  try {
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(2500)]);
    return NextResponse.json({ suggestions: await getVideoSuggestions(value, signal) }, { headers });
  } catch {
    // Autocomplete is optional. Ordinary search must stay usable when the provider is unavailable.
    return NextResponse.json({ suggestions: [] }, { headers });
  }
}
