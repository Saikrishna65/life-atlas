import {sensitiveApiDenial} from '@/lib/security/api-authorization';
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function POST(request: Request) {
 const denial=await sensitiveApiDenial(request);if(denial)return denial;

  try {
    const body = await request.json();
    const {
      title,
      destination,
      startDate,
      endDate,
      description,
      coverImage,
      duration,
      places = [],
      memories = [],
      itineraryDays = [],
      totalDistanceKm,
      elevationGainMeters,
      maxElevationMeters,
      routeData,
      existingSlug,
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

    // 2. Resolve Slug & Existing Trip Check (Upsert support)
    const rawSlug = (title || destination)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "") || "vault-expedition";

    let slug = existingSlug || rawSlug;
    let existingTrip = null;

    if (existingSlug) {
      existingTrip = await prisma.trip.findUnique({ where: { slug: existingSlug } });
    }
    if (!existingTrip) {
      existingTrip = await prisma.trip.findUnique({ where: { slug: rawSlug } });
      if (existingTrip) {
        slug = rawSlug;
      }
    }

    // Compute duration string
    let durationStr: string | null = duration || null;
    const startObj = new Date(startDate);
    const endObj = endDate ? new Date(endDate) : null;
    if (!durationStr && endObj) {
      const days = Math.max(1, Math.round((endObj.getTime() - startObj.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      durationStr = `${days} Days`;
    }

    let fullDescription = description || `Expedition across ${destination}. Published from Life Atlas Trip Vault.`;
    if (totalDistanceKm && Number(totalDistanceKm) > 0 && !fullDescription.includes("Distance Traveled")) {
      fullDescription += `\n\nTotal Expedition Distance Traveled: ${Number(totalDistanceKm).toFixed(1)} km.`;
    }

    let trip;
    if (existingTrip) {
      // Update existing public trip
      trip = await prisma.trip.update({
        where: { id: existingTrip.id },
        data: {
          title,
          destination,
          startDate: startObj,
          endDate: endObj,
          duration: durationStr,
          description: fullDescription,
          coverImage: coverImage || existingTrip.coverImage,
          totalDistanceKm: typeof totalDistanceKm === "number" ? totalDistanceKm : (totalDistanceKm ? parseFloat(totalDistanceKm) : null),
          elevationGainMeters: typeof elevationGainMeters === "number" ? elevationGainMeters : (elevationGainMeters ? parseFloat(elevationGainMeters) : null),
          maxElevationMeters: typeof maxElevationMeters === "number" ? maxElevationMeters : (maxElevationMeters ? parseFloat(maxElevationMeters) : null),
          routeData: routeData || undefined,
        },
      });
      // Clear previous child records to perform a clean refresh
      await prisma.tripDay.deleteMany({ where: { tripId: trip.id } });
      await prisma.tripPlace.deleteMany({ where: { tripId: trip.id } });
      await prisma.photo.deleteMany({ where: { tripId: trip.id } });
    } else {
      // Generate guaranteed unique slug for new trip
      let suffix = 1;
      while (await prisma.trip.findUnique({ where: { slug } })) {
        slug = `${rawSlug}-${suffix++}`;
      }
      trip = await prisma.trip.create({
        data: {
          title,
          slug,
          destination,
          startDate: startObj,
          endDate: endObj,
          duration: durationStr,
          description: fullDescription,
          coverImage: coverImage || null,
          totalDistanceKm: typeof totalDistanceKm === "number" ? totalDistanceKm : (totalDistanceKm ? parseFloat(totalDistanceKm) : null),
          elevationGainMeters: typeof elevationGainMeters === "number" ? elevationGainMeters : (elevationGainMeters ? parseFloat(elevationGainMeters) : null),
          maxElevationMeters: typeof maxElevationMeters === "number" ? maxElevationMeters : (maxElevationMeters ? parseFloat(maxElevationMeters) : null),
          routeData: routeData || undefined,
          userId: user.id,
        },
      });
    }

    // 3. Link / Create Places in Prisma and connect TripPlaces
    const placeMap = new Map<string, string>(); // placeName.toLowerCase() -> placeId
    let placesExportCount = 0;

    if (Array.isArray(places) && places.length > 0) {
      for (const pl of places) {
        const plName = typeof pl === "string" ? pl.trim() : (pl?.title || pl?.name)?.trim();
        if (!plName) continue;

        const plSlug = plName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "") || "place";
        let place = await prisma.place.findFirst({
          where: {
            OR: [
              { slug: plSlug },
              { name: { equals: plName, mode: "insensitive" } },
            ],
          },
        });

        if (!place) {
          place = await prisma.place.create({
            data: {
              name: plName,
              slug: plSlug,
              country: "India",
              region: typeof pl === "object" ? pl.region || "Uttarakhand" : null,
              latitude: typeof pl === "object" && typeof pl.latitude === "number" ? pl.latitude : null,
              longitude: typeof pl === "object" && typeof pl.longitude === "number" ? pl.longitude : null,
              userId: user.id,
            },
          });
        }

        placeMap.set(plName.toLowerCase(), place.id);

        // Link TripPlace
        await prisma.tripPlace.upsert({
          where: {
            tripId_placeId: {
              tripId: trip.id,
              placeId: place.id,
            },
          },
          create: {
            tripId: trip.id,
            placeId: place.id,
            visitDate: startObj,
          },
          update: {},
        });
        placesExportCount++;
      }
    }

    // 4. Create TripDays if present
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

    // 5. Create Memories and Photos (Supports multiple images per memory!)
    let memoryExportCount = 0;
    let photoExportCount = 0;

    for (const mem of memories) {
      if (!mem.title) continue;

      const memDate = mem.date ? new Date(mem.date) : startObj;
      const memPlaceName = (mem.placeName || mem.location)?.trim();
      const memPlaceId = memPlaceName ? placeMap.get(memPlaceName.toLowerCase()) : undefined;

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

      // Collect all photo URLs from memory (multi-image support!)
      const photoUrls: string[] = Array.isArray(mem.images) && mem.images.length > 0
        ? mem.images
        : mem.imageUrl
        ? [mem.imageUrl]
        : [];

      for (let pIdx = 0; pIdx < photoUrls.length; pIdx++) {
        const photoUrl = photoUrls[pIdx];
        if (!photoUrl) continue;

        await prisma.photo.create({
          data: {
            url: photoUrl,
            caption: mem.caption ? `${mem.title} — ${mem.caption}` : mem.title,
            date: memDate,
            tripId: trip.id,
            placeId: memPlaceId || null,
            userId: user.id,
          },
        });
        photoExportCount++;
      }
    }

    // 6. Revalidate Next.js cache for public routes
    try {
      revalidatePath("/");
      revalidatePath("/trips");
      revalidatePath(`/trips/${trip.slug}`);
      revalidatePath("/timeline");
      revalidatePath("/photography");
      revalidatePath("/explore");
    } catch (e) {
      console.warn("Revalidation notice:", e);
    }

    return NextResponse.json({
      success: true,
      tripId: trip.id,
      slug: trip.slug,
      publicUrl: `/trips/${trip.slug}`,
      placesCount: placesExportCount,
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
        error: `Could not export to public journal. Details: ${msg}`,
      },
      { status: 500 }
    );
  }
}
