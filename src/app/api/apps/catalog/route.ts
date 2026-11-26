import { NextResponse } from "next/server";
import { checkVideoRelease } from "@/lib/companion-apps/catalogue";
export const runtime = "nodejs";
export const maxDuration = 20;
export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  try {
    const release = await checkVideoRelease(
      AbortSignal.any([request.signal, AbortSignal.timeout(15000)]),
    );
    return NextResponse.json(
      {
        schemaVersion: 1,
        packages: release ? [release] : [],
        notes: release?.notes || "",
      },
      { headers },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "Could not check Android releases. Try again when you’re online.",
      },
      { status: 503, headers },
    );
  }
}
