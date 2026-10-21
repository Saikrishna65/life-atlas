import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { destination, durationDays = 5, travelStyle = "BACKPACKING", intensity = "MODERATE" } = body;

    const apiKey = process.env.NEON_AI_GATEWAY_TOKEN || process.env.OPENAI_API_KEY;
    const rawBaseUrl = process.env.NEON_AI_GATEWAY_BASE_URL || process.env.OPENAI_BASE_URL;

    // If no AI credentials are provisioned, gracefully signal client to use offline curated engine
    if (!apiKey) {
      return NextResponse.json({ offline: true, message: "AI Gateway credentials not configured. Using offline knowledge engine." });
    }

    const baseUrl = rawBaseUrl
      ? rawBaseUrl.endsWith("/v1")
        ? rawBaseUrl
        : `${rawBaseUrl}/v1`
      : "https://api.openai.com/v1";

    const prompt = `You are an expert expedition travel planner.
Generate a structured day-by-day expedition plan for:
Destination: ${destination}
Duration: ${durationDays} days
Travel Style: ${travelStyle}
Intensity: ${intensity}

Return ONLY a valid JSON object matching this schema:
{
  "destination": "${destination}",
  "durationDays": ${durationDays},
  "travelStyle": "${travelStyle}",
  "budgetEstimate": 25000,
  "generatedDays": [
    {
      "dayNumber": 1,
      "title": "Title of day",
      "highlights": ["Highlight 1", "Highlight 2"],
      "suggestedStayArea": "Town/Area",
      "intensity": "MODERATE",
      "activities": [
        { "timeSlot": "MORNING", "startTime": "08:00", "title": "Morning activity", "notes": "Tips" },
        { "timeSlot": "AFTERNOON", "startTime": "13:00", "title": "Afternoon activity", "notes": "Tips" },
        { "timeSlot": "EVENING", "startTime": "18:00", "title": "Evening activity", "notes": "Tips" }
      ]
    }
  ],
  "suggestedGear": ["Item 1", "Item 2"],
  "localAdvisories": ["Advisory 1", "Advisory 2"]
}`;

    const aiRes = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-5-mini",
        messages: [
          { role: "system", content: "You are an expedition travel architect. Output pure JSON only." },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!aiRes.ok) {
      console.warn("AI Gateway HTTP error:", aiRes.status);
      return NextResponse.json({ offline: true });
    }

    const data = await aiRes.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return NextResponse.json({ offline: true });
    }

    // Extract JSON from potential code blocks
    const cleanJson = content.replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/```$/, "").trim();
    const parsed = JSON.parse(cleanJson);

    return NextResponse.json(parsed);
  } catch (err) {
    console.warn("AI generation route error:", err);
    return NextResponse.json({ offline: true });
  }
}
