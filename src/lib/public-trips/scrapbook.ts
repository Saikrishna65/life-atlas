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
  { id: "ridge", tripId: "himalayan-journey", tripTitle: "The Himalayan Journey", src: "/images/world/ridge.webp", preview: "/images/world/ridge.webp", title: "The long way up", kind: "photo", sample: true },
  { id: "mist", tripId: "river-ritual-repeat", tripTitle: "River, ritual, repeat", src: "/images/world/mist.webp", preview: "/images/world/mist.webp", title: "Before the world wakes", kind: "photo", sample: true },
  { id: "highlands", tripId: "himalayan-journey", tripTitle: "The Himalayan Journey", src: "/films/hero/highlands.mp4", preview: "/images/world/mountains.webp", title: "A little mountain daydream", kind: "film", sample: true },
  { id: "valley", tripId: "the-green-southern-road", tripTitle: "The green southern road", src: "/images/world/valley.webp", preview: "/images/world/valley.webp", title: "Somewhere worth stopping", kind: "photo", sample: true },
  { id: "mountains", tripId: "himalayan-journey", tripTitle: "The Himalayan Journey", src: "/images/world/mountains.webp", preview: "/images/world/mountains.webp", title: "Nothing but the view", kind: "photo", sample: true },
  { id: "coast", tripId: "river-ritual-repeat", tripTitle: "River, ritual, repeat", src: "/films/hero/coast.mp4", preview: "/images/world/ocean.webp", title: "Let the day drift", kind: "film", sample: true },
  { id: "ocean", tripId: "the-green-southern-road", tripTitle: "The green southern road", src: "/images/world/ocean.webp", preview: "/images/world/ocean.webp", title: "At the edge of everything", kind: "photo", sample: true },
  { id: "garden", tripId: "the-green-southern-road", tripTitle: "The green southern road", src: "/films/hero/gardens.mp4", preview: "/images/world/valley.webp", title: "A slower kind of afternoon", kind: "film", sample: true },
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
