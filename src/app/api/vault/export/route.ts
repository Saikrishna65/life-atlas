import {mergeTripPublication} from "@/lib/studio/publication";
import {ensureWebsiteSchema} from "@/lib/studio/server";
import {allowAtlasMutation} from "@/lib/mobileRequest";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function POST(request: Request) {
  if(!allowAtlasMutation(request,"x-atlas-publish"))return NextResponse.json({error:"Publish through your Atlas app."},{status:403});
  try {
    if(Number(request.headers.get("content-length")||0)>3*1024*1024)return NextResponse.json({error:"Upload large originals to R2 first."},{status:413});
    const body = await request.json();
    const {
      title,
      destination="",
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
      preserveExistingRoute=false,
      publicMedia=[],
      preserveExistingMedia=false,
      appendExistingMedia=false,
      preserveExistingItinerary=false,
    } = body;

    if (typeof title!=="string" || !title.trim() || title.length>150 || typeof destination!=="string" || (startDate && !Number.isFinite(Date.parse(startDate)))) {
      return NextResponse.json(
        { error: "Add a trip title and valid dates when provided." },
        { status: 400 }
      );
    }

    if(!Array.isArray(publicMedia)||publicMedia.length>250||publicMedia.some((item: {url?:unknown;poster?:unknown;kind?:unknown})=>!item||!['photo','video'].includes(String(item.kind))||typeof item.url!=='string'||!/^https:\/\//.test(item.url)||(item.poster&&!/^https:\/\//.test(String(item.poster)))))return NextResponse.json({error:'Choose valid public media URLs.'},{status:400});
    if(!Array.isArray(places)||places.length>200||places.some(pl=>pl&&typeof pl==='object'&&((pl.id!==undefined&&(typeof pl.id!=='string'||!/^[-a-zA-Z0-9_]{1,80}$/.test(pl.id)))||((pl.latitude!==undefined||pl.longitude!==undefined)&&(!Number.isFinite(pl.latitude)||!Number.isFinite(pl.longitude)||Math.abs(pl.latitude)>90||Math.abs(pl.longitude)>180)))))return NextResponse.json({error:'Choose a valid trip map location.'},{status:400});
    await ensureWebsiteSchema();
    const saved=await prisma.$transaction(async db=>{
    // 1. Get or create author user
    let user = await db.user.findUnique({
      where: { email: "author@lifeatlas.com" },
    });

    if (!user) {
      user = await db.user.findFirst();
    }

    if (!user) {
      user = await db.user.create({
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
      existingTrip = await db.trip.findUnique({ where: { slug: existingSlug } });
    }
    if (!existingTrip && !existingSlug) {
      existingTrip = await db.trip.findUnique({ where: { slug: rawSlug } });
      if (existingTrip) {
        slug = rawSlug;
      }
    }

    // Compute duration string
    let durationStr: string | null = duration || null;
    const startObj = startDate ? new Date(startDate) : null;
    const endObj = endDate ? new Date(endDate) : null;
    if (!durationStr && endObj && startObj) {
      const days = Math.max(1, Math.round((endObj.getTime() - startObj.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      durationStr = `${days} Days`;
    }

    const fullDescription = typeof description === "string" ? description.trim() || null : null;


    const priorRoute=existingTrip?.routeData && typeof existingTrip.routeData==='object'&&!Array.isArray(existingTrip.routeData)?existingTrip.routeData:{};
    const nextRoute=routeData&&typeof routeData==='object'&&!Array.isArray(routeData)?routeData:preserveExistingRoute?priorRoute:{};
    const storedRoute={...nextRoute} as Record<string,unknown>;
    if((preserveExistingMedia||appendExistingMedia) && "publication" in priorRoute)storedRoute.publication=priorRoute.publication;
    if(!preserveExistingMedia&&!appendExistingMedia)delete storedRoute.publication;
    if(publicMedia.length)storedRoute.publication={media:mergeTripPublication((priorRoute as {publication?:{media?:unknown[]}}).publication?.media,publicMedia,appendExistingMedia)};
    const retainedTotals={distance:existingTrip?.totalDistanceKm??null,ascent:existingTrip?.elevationGainMeters??null,altitude:existingTrip?.maxElevationMeters??null};
    let trip;
    if (existingTrip) {
      // Update existing public trip
      trip = await db.trip.update({
        where: { id: existingTrip.id },
        data: {
          title,
          destination,
          startDate: startObj,
          endDate: endObj,
          duration: durationStr,
          description: fullDescription,
          coverImage: coverImage || existingTrip.coverImage,
          totalDistanceKm: typeof totalDistanceKm === "number" ? totalDistanceKm : (totalDistanceKm ? parseFloat(totalDistanceKm) : preserveExistingRoute ? retainedTotals.distance : null),
          elevationGainMeters: typeof elevationGainMeters === "number" ? elevationGainMeters : (elevationGainMeters ? parseFloat(elevationGainMeters) : preserveExistingRoute ? retainedTotals.ascent : null),
          maxElevationMeters: typeof maxElevationMeters === "number" ? maxElevationMeters : (maxElevationMeters ? parseFloat(maxElevationMeters) : preserveExistingRoute ? retainedTotals.altitude : null),
          routeData: Object.keys(storedRoute).length ? storedRoute as Prisma.InputJsonValue : Prisma.DbNull,
        },
      });
      // Clear previous child records to perform a clean refresh
      if(!preserveExistingItinerary)await db.tripDay.deleteMany({ where: { tripId: trip.id } });
      if(!appendExistingMedia)await db.tripPlace.deleteMany({ where: { tripId: trip.id } });
      if(!preserveExistingMedia&&!appendExistingMedia)await db.photo.deleteMany({ where: { tripId: trip.id } });
    } else {
      // Generate guaranteed unique slug for new trip
      let suffix = 1;
      while (await db.trip.findUnique({ where: { slug } })) {
        slug = `${rawSlug}-${suffix++}`;
      }
      trip = await db.trip.create({
        data: {
          title,
          slug,
          destination,
          startDate: startObj,
          endDate: endObj,
          duration: durationStr,
          description: fullDescription,
          coverImage: coverImage || null,
          totalDistanceKm: typeof totalDistanceKm === "number" ? totalDistanceKm : (totalDistanceKm ? parseFloat(totalDistanceKm) : preserveExistingRoute ? retainedTotals.distance : null),
          elevationGainMeters: typeof elevationGainMeters === "number" ? elevationGainMeters : (elevationGainMeters ? parseFloat(elevationGainMeters) : preserveExistingRoute ? retainedTotals.ascent : null),
          maxElevationMeters: typeof maxElevationMeters === "number" ? maxElevationMeters : (maxElevationMeters ? parseFloat(maxElevationMeters) : preserveExistingRoute ? retainedTotals.altitude : null),
          routeData: Object.keys(storedRoute).length ? storedRoute as Prisma.InputJsonValue : Prisma.DbNull,
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

        const scoped=typeof pl==='object'&&typeof pl.id==='string'?`${trip.slug}-${pl.id}`:"";
        const plSlug = scoped || plName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "") || "place";
        let place = await db.place.findFirst({
          where: {
            OR: [
              { slug: plSlug },
              ...(scoped?[]:[{ name: { equals: plName, mode: "insensitive" as const } }]),
            ],
          },
        });

        if (!place) {
          place = await db.place.create({
            data: {
              name: plName,
              slug: plSlug,
              country: "Unspecified",
              region: typeof pl === "object" ? pl.region || null : null,
              latitude: typeof pl === "object" && typeof pl.latitude === "number" ? pl.latitude : null,
              longitude: typeof pl === "object" && typeof pl.longitude === "number" ? pl.longitude : null,
              userId: user.id,
            },
          });
        }

        if(typeof pl==='object'&&Number.isFinite(pl.latitude)&&Number.isFinite(pl.longitude)&&Math.abs(pl.latitude)<=90&&Math.abs(pl.longitude)<=180){place=await db.place.update({where:{id:place.id},data:{latitude:pl.latitude,longitude:pl.longitude,...(scoped?{name:plName}:{})}});}
        if(scoped&&place.name!==plName)place=await db.place.update({where:{id:place.id},data:{name:plName}});
        placeMap.set(plName.toLowerCase(), place.id);

        // Link TripPlace
        await db.tripPlace.upsert({
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
        if (!day.title?.trim() && !day.description?.trim()) continue;
        await db.tripDay.create({
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
      const createdMem = await db.memory.create({
        data: {
          title: mem.title,
          description: mem.caption || null,
          date: memDate,
          userId: user.id,
        },
      });

      // Create TimelineEvent
      if(memDate)await db.timelineEvent.create({
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

        await db.photo.create({
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

    for(const item of publicMedia){
      if(item.kind==='photo'){await db.photo.create({data:{url:item.url,caption:null,tripId:trip.id,userId:user.id}});photoExportCount++;}
    }

    return {trip,placesExportCount,memoryExportCount,photoExportCount};
    },{timeout:30000});
    const {trip,placesExportCount,memoryExportCount,photoExportCount}=saved;

    // 6. Revalidate Next.js cache for public routes
    try {
      revalidatePath("/");
      revalidatePath("/trips");
      revalidatePath(`/trips/${trip.slug}`);
      revalidatePath("/timeline");
      revalidatePath("/photography");
      revalidatePath("/explore");
      revalidatePath("/map");
      revalidatePath("/places");
      revalidatePath("/places/[slug]","page");
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
    if(err instanceof RangeError&&err.message==='PUBLIC_MEDIA_LIMIT')return NextResponse.json({error:'This trip supports up to 250 public photos and videos.'},{status:400});
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
