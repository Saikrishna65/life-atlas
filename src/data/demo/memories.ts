import { destinations } from "./expeditions";
import type { GalleryImage, Memory } from "./types";
import { memoryNotes } from "./memory-notes";
const categories = ["Stillness", "Discovery", "People"] as const;
const studies = {
  Mountains: ["mountains", "mist", "ridge", "valley", "ocean"],
  Nature: ["valley", "mist", "ridge", "mountains", "ocean"],
  Coast: ["ocean", "valley", "ridge", "mist", "mountains"],
  Culture: ["ridge", "valley", "mist", "mountains", "ocean"],
  City: ["space", "valley", "ocean", "mist", "ridge"],
};
const frames = [
  "A study of morning light",
  "A horizon held in silence",
  "Texture, weather, and distance",
  "The shape of a slow afternoon",
  "Light at the edge of the day",
];
export const gallery: GalleryImage[] = destinations.flatMap((d, i) =>
  frames.map((caption, j) => ({
    id: `photo-${i * 5 + j + 1}`,
    destinationId: d.id,
    src: `/images/world/${studies[d.category][j]}.webp`,
    thumbnail: `/images/world/${studies[d.category][j]}-small.webp`,
    alt: `${caption}. Illustrative ${d.category.toLowerCase()} landscape for the ${d.name} sample journal.`,
    caption: `${caption} · ${d.name}`,
    orientation: (i + j) % 3 === 0 ? "portrait" : "landscape",
    sourceId: studies[d.category][j],
    illustrative: true,
  })),
);
export const memories: Memory[] = destinations.flatMap((d, i) =>
  memoryNotes[i].map(([title, description], j) => ({
    id: `memory-${i * 3 + j + 1}`,
    title: `${title} · ${d.name}`,
    destinationId: d.id,
    date: new Date(Date.UTC(2025, Math.floor(i / 3), 3 + (i % 3) * 7 + j))
      .toISOString()
      .slice(0, 10),
    category: categories[j],
    description: `${description} An imagined journal entry from ${d.name}, ${d.region}.`,
    tags: [
      categories[j].toLowerCase(),
      d.category.toLowerCase(),
      d.name.toLowerCase(),
    ],
    photoIds: [d.galleryIds[j], d.galleryIds[(j + 1) % 5]],
    expeditionIds: d.expeditionIds,
    featured: j === 0 && i % 3 === 0,
  })),
);
