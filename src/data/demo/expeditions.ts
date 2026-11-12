import { destinations as places } from "./destinations";
import { timelineChapters } from "./timeline-chapters";
import type { Expedition, Milestone, TimelineEvent } from "./types";
const routes: [string, number[], string][] = [
  [
    "The Himalayan Journey",
    [1, 2, 3],
    "A quiet ascent from forest floor to open sky.",
  ],
  [
    "River, ritual, repeat",
    [4, 6],
    "Two river cities, and two completely different ways to greet a morning.",
  ],
  [
    "The green southern road",
    [5, 20, 22],
    "Tea, coffee, and the long way down to the water.",
  ],
  [
    "A desert in slow motion",
    [7, 17, 18],
    "Sandstone cities linked by golden light and good food.",
  ],
  [
    "Cabins above the clouds",
    [8, 9, 10],
    "A small mountain loop with enough room for doing very little.",
  ],
  [
    "The forest notebook",
    [10, 11],
    "Riverside walks and village conversations in a green valley.",
  ],
  [
    "Somewhere between earth and sky",
    [12, 13],
    "Monastery courtyards and the open skies of Kangra.",
  ],
  [
    "The high desert diaries",
    [13, 14],
    "A deliberately slow introduction to altitude and mountain life.",
  ],
  [
    "Beyond the last bend",
    [15],
    "Rest days, heritage walks, and broad Ladakhi horizons.",
  ],
  [
    "A lake, a garden, a morning",
    [16],
    "A gentle Srinagar stay with early starts and long lunches.",
  ],
  [
    "Rajasthan, in three colors",
    [17, 18, 7],
    "A cultural route through pink, white, and golden sandstone.",
  ],
  [
    "The stones remember",
    [19],
    "Architecture, boulder country, and stories beside the river.",
  ],
  [
    "Coffee before everything",
    [20, 5],
    "Two hill regions connected by early mornings and warm cups.",
  ],
  [
    "Where the land lets go",
    [21, 22],
    "A coastal itinerary built around water, village food, and rest.",
  ],
  [
    "The other side of midnight",
    [23, 24, 25],
    "Three Japanese cities, discovered one neighborhood at a time.",
  ],
  [
    "The mountain in the window",
    [23, 26],
    "Leave the city for lakeside walks and distant mountain views.",
  ],
  [
    "Seoul on foot",
    [27],
    "Palace grounds, small galleries, and late market dinners.",
  ],
  [
    "An island without a rush",
    [28],
    "A quieter Balinese route between rice country and the sea.",
  ],
  [
    "The long way through the Alps",
    [29, 32],
    "A sample rail-and-walk journey through two alpine regions.",
  ],
  [
    "A country made of weather",
    [30],
    "A cautious south-coast route with weather days left open.",
  ],
  [
    "Atlantic afternoons",
    [31],
    "Hillside neighborhoods, tile workshops, and slow waterfront evenings.",
  ],
  [
    "Valleys from another time",
    [33],
    "A ground-level exploration of volcanic valleys and cave heritage.",
  ],
  [
    "Under a northern sky",
    [34],
    "Harbor walks and coastal roads in the Lofoten islands.",
  ],
  [
    "The eastern mountain letter",
    [35, 36],
    "Two independent Himalayan chapters; allow transit days between them.",
  ],
];
export const expeditions: Expedition[] = routes.map(
  ([name, ids, overview], i) => {
    const destinations = ids.map((id) => places[id - 1]);
    const duration = Math.max(5, destinations.length * 3);
    const accommodation = duration * (i > 13 ? 5200 : 1800),
      transport = 8000 + i * 1700,
      food = duration * 950,
      activities = 2500 + i * 550;
    return {
      id: `exp-${i + 1}`,
      slug:
        i === 0
          ? "himalayan-journey"
          : name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      name,
      destinationIds: destinations.map((d) => d.id),
      route: destinations.map((d) => d.name),
      duration,
      difficulty: destinations.some((d) => d.category === "Mountains")
        ? "Moderate"
        : "Easy",
      category: destinations[0].category,
      overview: `${overview} This is an illustrative itinerary, with time for local guidance and changing conditions.`,
      activities: destinations.flatMap((d) => d.highlights).slice(0, 7),
      itinerary: Array.from({ length: duration }, (_, j) => {
        const d =
          destinations[Math.min(destinations.length - 1, Math.floor(j / 3))];
        const phase = j % 3;
        return {
          day: j + 1,
          title: [
            `Arrive slowly in ${d.name}`,
            `Follow the rhythm of ${d.name}`,
            `An unplanned afternoon in ${d.name}`,
          ][phase],
          description: [
            `Settle into a locally run stay. Walk the neighborhood, check local conditions, and leave the evening free.`,
            `Make time for ${d.highlights[0].toLowerCase()} and ${d.highlights[1].toLowerCase()}. Confirm opening hours and transport locally.`,
            `Try ${d.highlights[2].toLowerCase()}. Keep a generous buffer for rest, weather, or a conversation worth staying for.`,
          ][phase],
          destinationId: d.id,
        };
      }),
      packing: [
        "Refillable water bottle",
        "Comfortable walking shoes",
        "Weather-appropriate layers",
        "Offline maps and charged power bank",
        destinations[0].category === "Mountains"
          ? "Sun protection and a warm outer layer"
          : "Light rain layer and a small day bag",
        "Personal medication and travel documents",
      ],
      cost: {
        accommodation,
        transport,
        food,
        activities,
        total: accommodation + transport + food + activities,
        currency: "INR",
        example: true,
      },
      galleryIds: destinations.flatMap((d) => d.galleryIds),
      weather:
        destinations[0].category === "Mountains"
          ? "Expect cool mornings, rapidly changing conditions, and possible route closures. Check a current local forecast."
          : "Seasonal rain and temperature changes can affect the day. Check a current local forecast before departure.",
      moments: destinations.map((d) => `${d.highlights[0]} in ${d.name}`),
      transport: ids.includes(35)
        ? "These are separate country chapters. Plan permits and cross-border flights independently; no direct connection is implied."
        : "Use established public transport between hubs where available. Arrange licensed local transport for remote legs; schedules and fares require local confirmation.",
      memoryIds: ids.flatMap((id) =>
        [0, 1, 2].map((j) => `memory-${(id - 1) * 3 + j + 1}`),
      ),
      image: destinations[0].image,
    };
  },
);
export const timelineEvents: TimelineEvent[] = expeditions.flatMap((e, i) =>
  timelineChapters[i].map(([title, stop], j) => ({
    id: `event-${i * 5 + j + 1}`,
    expeditionId: e.id,
    destinationId: e.destinationIds[stop],
    date: new Date(Date.UTC(2025, Math.floor(i / 2), 2 + (i % 2) * 13 + j))
      .toISOString()
      .slice(0, 10),
    title,
    description: `${title}. A fictional field note from ${e.route[stop]}, part of ${e.name}. ${places.find((p) => p.id === e.destinationIds[stop])!.description}`,
  })),
);
export const destinations = places.map((p) => ({
  ...p,
  expeditionIds: expeditions
    .filter((e) => e.destinationIds.includes(p.id))
    .map((e) => e.id),
  timelineIds: timelineEvents
    .filter((e) => e.destinationId === p.id)
    .map((e) => e.id),
}));
export const milestones: Milestone[] = Array.from({ length: 42 }, (_, i) => ({
  id: `milestone-${i + 1}`,
  destinationId: places[i % places.length].id,
  date: new Date(Date.UTC(2025, Math.floor(i / 4), 2 + (i % 24)))
    .toISOString()
    .slice(0, 10),
  title: `${["A first dawn", "A slower journey", "A new perspective", "A favorite footpath", "A local conversation", "A return worth making"][i % 6]} · ${places[i % places.length].name}`,
}));
