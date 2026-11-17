import {publishedTripMedia} from "../public-trips/detail";
import prisma from "../prisma";
import { scrapbookSamples, type ScrapbookFrame } from "../public-trips/scrapbook";

/** Existing public web trip photographs only; never a native/private vault. */
export async function getScrapbookMedia(): Promise<ScrapbookFrame[]> {
  try {
    const trips = await prisma.trip.findMany({
      orderBy: [{ startDate: "desc" }, { id: "asc" }],
      select: { slug: true, title: true, routeData:true, photos: {
        where: { url: { not: "" } }, take: 8,
        orderBy: [{ isFeatured: "desc" }, { date: "desc" }, { id: "asc" }],
        select: { id: true, url: true, caption: true },
      } },
    });
    const frames: ScrapbookFrame[] = trips.flatMap(trip => [...trip.photos.map(photo => ({
      id: photo.id, tripId: trip.slug, tripTitle: trip.title, src: photo.url,
      preview: photo.url, title: photo.caption || trip.title, kind: "photo" as const, sample: false,
    })),...publishedTripMedia(trip.routeData).filter(item=>item.kind==="video").map(item=>({id:item.id,tripId:trip.slug,tripTitle:trip.title,src:item.url,preview:item.poster||item.url,title:trip.title,kind:"film" as const,sample:false}))]);
    if (frames.length) return frames;
  } catch { /* The public collection remains available without a database. */ }
  return scrapbookSamples;
}
