import { NextResponse } from "next/server";
import { parseBookingText } from "@/lib/vault/pnrParser";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { rawText } = body;

    if (!rawText || typeof rawText !== "string") {
      return NextResponse.json({ error: "No rawText provided" }, { status: 400 });
    }

    // Client-side regex engine is extremely fast and accurate for Indian tickets
    const parsed = parseBookingText(rawText);

    return NextResponse.json({
      success: true,
      result: parsed,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Parsing error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
