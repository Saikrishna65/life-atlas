import prisma from "../prisma";
import {readTripCover} from "../public-trips/cover";
import {publishedTripMedia} from "../public-trips/detail";
import type { HeroGalleryPhoto, HeroTrip } from "@/lib/public-trips/types";

/** Public travel records only. Native/local vault databases are never read here. */
export async function getLatestHeroTrips(slugs?:string[],source=prisma): Promise<HeroTrip[]> {
  try {
    const trips = await source.trip.findMany({
      take: 3,
      ...(slugs?{where:{slug:{in:slugs}}}:{}),
      orderBy: [{ startDate: "desc" }, { id: "asc" }],
      select: { id: true, slug: true, title: true, coverImage: true,routeData:true,photos:{take:1,select:{url:true}} },
    });
    if (trips.length)
      return [...trips].sort((a,b)=>slugs?slugs.indexOf(a.slug)-slugs.indexOf(b.slug):0).map((trip) => {
        const cover=readTripCover(trip.routeData),media=publishedTripMedia(trip.routeData);
        return ({
        id: trip.id,
        slug: trip.slug,
        title: trip.title,
        image: (cover?.kind==="photo"?cover.url:cover?.poster) || media.find(item=>item.url===trip.coverImage)?.poster || trip.coverImage || trip.photos[0]?.url || media.find(item=>item.kind==="photo")?.poster || media.find(item=>item.kind==="photo")?.url || "",
        sample: false,
        video:cover?cover.kind==="video"?cover.url:undefined:media.find(item=>item.kind==="video")?.url,
      });});
  } catch {
    /* The public homepage also works without a configured public database. */
  }
  return [];
}

/** One existing public photograph per trip, from two different trip journals. */
export async function getHeroGalleryPhotos(source=prisma): Promise<HeroGalleryPhoto[]> {
  try {
    const trips = await source.trip.findMany({
      take: 30,
      orderBy: [{ startDate: "desc" }, { id: "asc" }],
      select: {
        id: true, slug: true, title: true,routeData:true,
        photos: {
          where: { url: { not: "" } },
          take: 1,
          orderBy: [{ isFeatured: "desc" }, { date: "desc" }, { id: "asc" }],
          select: { id: true, url: true },
        },
      },
    });
    const photos = trips.flatMap(trip => {
      const photo=trip.photos[0] || publishedTripMedia(trip.routeData).find(item=>item.kind==='photo');
      return photo?[{id:photo.id,src:photo.url,tripId:trip.id,tripSlug:trip.slug,tripTitle:trip.title,sample:false}]:[];
    }).slice(0,2);
    if (photos.length) return photos;
  } catch {
    /* Never read a native vault when the public database is unavailable. */
  }
  return [];
}
