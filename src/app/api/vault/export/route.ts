import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      title,
      destination,
      startDate,
      endDate,
      description,
      coverImage,
      memories = [],
      itineraryDays = [],
    } = body;

    if (!title || !destination || !startDate) {
      return NextResponse.json(
        { error: "Title, destination, and startDate are required fields." },
        { status: 400 }
      );
    }

    // 1. Get or create author user
    let user = await prisma.user.findUnique({
      where: { email: "author@lifeatlas.com" },
    });

    if (!user) {
      user = await prisma.user.findFirst();
    }

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: "author@lifeatlas.com",
          name: "Life Atlas Voyager",
        },
      });
    }

    // 2. Generate unique slug
    const rawSlug = (title || destination)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "") || "vault-expedition";

    let slug = rawSlug;
    let suffix = 1;
    while (await prisma.trip.findUnique({ where: { slug } })) {
      slug = `${rawSlug}-${suffix++}`;
    }

    // 3. Compute duration string
    let durationStr: string | null = null;
    const startObj = new Date(startDate);
    const endObj = endDate ? new Date(endDate) : null;
    if (endObj) {
      const days = Math.max(1, Math.round((endObj.getTime() - startObj.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      durationStr = `${days} Days`;
    }

    // 4. Create public Trip in Prisma Postgres (REQ-MEM-03)
    const trip = await prisma.trip.create({
      data: {
        title,
        slug,
        destination,
        startDate: startObj,
        endDate: endObj,
        duration: durationStr,
        description: description || `Expedition across ${destination}. Published from Life Atlas Trip Vault.`,
        coverImage: coverImage || null,
        userId: user.id,
      },
    });

    // 5. Create TripDays if present
    if (Array.isArray(itineraryDays) && itineraryDays.length > 0) {
      for (const day of itineraryDays) {
        await prisma.tripDay.create({
          data: {
            tripId: trip.id,
            dayIndex: Number(day.dayIndex) || 0,
            date: day.date ? new Date(day.date) : startObj,
            title: day.title || `Day ${Number(day.dayIndex || 0) + 1}`,
            description: day.description || null,
          },
        });
      }
    }

    // 6. Create Memories and Photos
    let memoryExportCount = 0;
    let photoExportCount = 0;

    for (const mem of memories) {
      if (!mem.title) continue;

      const memDate = mem.date ? new Date(mem.date) : startObj;

      // Create Prisma Memory
      const createdMem = await prisma.memory.create({
        data: {
          title: mem.title,
          description: mem.caption || null,
          date: memDate,
          userId: user.id,
        },
      });

      // Create TimelineEvent
      await prisma.timelineEvent.create({
        data: {
          title: mem.title,
          description: mem.caption || null,
          date: memDate,
          type: "MEMORY",
          userId: user.id,
          memoryId: createdMem.id,
          referenceId: trip.id,
        },
      });
      memoryExportCount++;

      // Create Photo attached to Trip if image is present
      if (mem.imageUrl) {
        await prisma.photo.create({
          data: {
            url: mem.imageUrl,
            caption: mem.caption || mem.title,
            date: memDate,
            tripId: trip.id,
            userId: user.id,
          },
        });
        photoExportCount++;
      }
    }

    // 7. Revalidate Next.js cache for public routes
    try {
      revalidatePath("/");
      revalidatePath("/trips");
      revalidatePath(`/trips/${slug}`);
      revalidatePath("/timeline");
      revalidatePath("/photography");
    } catch (e) {
      console.warn("Revalidation notice:", e);
    }

    return NextResponse.json({
      success: true,
      tripId: trip.id,
      slug: trip.slug,
      publicUrl: `/trips/${trip.slug}`,
      memoryCount: memoryExportCount,
      photoCount: photoExportCount,
      message: `Expedition successfully published to Life Atlas Public Journal!`,
    });
  } catch (err: unknown) {
    console.error("Public Journal Export Error:", err);
    const msg = err instanceof Error ? err.message : "Internal database error";
    return NextResponse.json(
      {
        success: false,
        error: `Could not export to public journal. If you are offline, please connect to network and try again. Details: ${msg}`,
      },
      { status: 500 }
    );
  }
}
