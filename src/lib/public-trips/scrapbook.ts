import type { PublishedMedia } from "../r2/types";

export interface ScrapbookFrame {
  id: string;
  tripId: string;
  tripTitle: string;
  src: string;
  preview: string;
  title: string;
  kind: "photo" | "film";
  sample: boolean;
}

export const scrapbookSamples: ScrapbookFrame[] = [
  { id:"stock-peaks", tripId:"himalayan-journey", tripTitle:"The Himalayan Journey", src:"/images/stock/wall-peaks.webp", preview:"/images/stock/wall-peaks.webp", title:"Above the clouds · Stock photograph", kind:"photo", sample:true },
  { id:"stock-starry", tripId:"himalayan-journey", tripTitle:"The Himalayan Journey", src:"/images/stock/wall-starry.webp", preview:"/images/stock/wall-starry.webp", title:"Under the stars · Stock photograph", kind:"photo", sample:true },
  { id:"stock-trail", tripId:"the-green-southern-road", tripTitle:"The green southern road", src:"/images/stock/phone-mountain.webp", preview:"/images/stock/phone-mountain.webp", title:"The next ridge · Stock photograph", kind:"photo", sample:true },
  { id:"stock-coffee", tripId:"river-ritual-repeat", tripTitle:"River, ritual, repeat", src:"/images/stock/coffee.webp", preview:"/images/stock/coffee.webp", title:"A shared pause · Stock photograph", kind:"photo", sample:true },
  { id:"stock-friends", tripId:"river-ritual-repeat", tripTitle:"River, ritual, repeat", src:"/images/stock/people-friends.webp", preview:"/images/stock/people-friends.webp", title:"Good company · Stock photograph", kind:"photo", sample:true },
  { id:"stock-peaks-motion", tripId:"himalayan-journey", tripTitle:"The Himalayan Journey", src:"/films/stock/peaks.mp4", preview:"/images/stock/wall-peaks.webp", title:"Above the clouds · Animated stock photo, not travel footage", kind:"film", sample:true },
  { id:"stock-starry-motion", tripId:"river-ritual-repeat", tripTitle:"River, ritual, repeat", src:"/films/stock/stars.mp4", preview:"/images/stock/wall-starry.webp", title:"Under the stars · Animated stock photo, not travel footage", kind:"film", sample:true },
  { id:"stock-trail-motion", tripId:"the-green-southern-road", tripTitle:"The green southern road", src:"/films/stock/trail.mp4", preview:"/images/stock/phone-mountain.webp", title:"The next ridge · Animated stock photo, not travel footage", kind:"film", sample:true },
];
const normalize = (value: string) => value.trim().normalize("NFC").toLocaleLowerCase("en");

export function catalogScrapbookFrames(items: PublishedMedia[], photos: ScrapbookFrame[]): ScrapbookFrame[] {
  return items.filter(item => item.category === "expedition" && item.collection.trim()
    && /^(image|video)\//.test(item.mimeType)).map(item => {
    const trip = photos.find(photo => [photo.tripId, photo.tripTitle].some(value => normalize(value) === normalize(item.collection)));
    return { id: `published-${item.id}`, tripId: trip?.tripId || normalize(item.collection), tripTitle: trip?.tripTitle || item.collection.trim(), src: item.url, preview: item.thumbnailUrl || (item.mimeType.startsWith("image/") ? item.url : ""), title: item.title, kind: item.mimeType.startsWith("video/") ? "film" : "photo", sample: false };
  });
}

/** A seeded shuffle varies visits while keeping selection stable during interaction. */
function shuffle<T>(items: T[], seed: number): T[] {
  const result = [...items];
  let value = seed >>> 0;
  for (let index = result.length - 1; index > 0; index--) {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    const other = value % (index + 1);
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

/** One available photo AND film from each trip before taking extra media.
 * The strip keeps every trip represented even when the collage has eight slots.
 * Samples are used only when no real public trip media exists. */
export function selectScrapbookFrames(candidates: ScrapbookFrame[], seed: number, minimum = 8): ScrapbookFrame[] {
  const real = candidates.filter(frame => !frame.sample);
  const pool = real.length ? real : candidates;
  const unique = [...new Map(pool.map(frame => [`${frame.tripId}:${frame.src}`, frame])).values()];
  const mixed = shuffle(unique, seed);
  const trips = new Map<string, ScrapbookFrame[]>();
  for (const frame of mixed) trips.set(frame.tripId, [...(trips.get(frame.tripId) ?? []), frame]);
  const chosen: ScrapbookFrame[] = [];
  for (const group of trips.values()) {
    for (const kind of ["photo", "film"] as const) {
      const frame = group.find(item => item.kind === kind);
      if (frame) chosen.push(frame);
    }
  }
  for (const frame of mixed) {
    if (chosen.length >= minimum) break;
    if (!chosen.includes(frame)) chosen.push(frame);
  }
  return shuffle(chosen, seed ^ 0x9e3779b9);
}
