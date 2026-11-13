import type { Expedition } from "./types";
import { destinations } from "./expeditions";
export interface DayBeat {
  time: string;
  title: string;
  description: string;
  kind: "Travel" | "Explore" | "Pause" | "Stay";
}
export interface DetailedDay {
  day: number;
  place: string;
  headline: string;
  description: string;
  overnight: string;
  beats: DayBeat[];
}
export function detailedDays(expedition: Expedition): DetailedDay[] {
  return expedition.itinerary.map((day, index) => {
    const place =
      destinations.find((d) => d.id === day.destinationId)?.name ??
      expedition.route[0];
    const first = index === 0,
      last = index === expedition.itinerary.length - 1;
    const activity =
      expedition.activities[index % expedition.activities.length] ??
      "Explore the surroundings";
    return {
      day: day.day,
      place,
      headline: day.title,
      description: day.description,
      overnight: last
        ? "Departure / onward travel"
        : "Example local stay in " + place,
      beats: [
        {
          time: first ? "08:30" : "06:30",
          title: first ? "Arrive without rushing" : "Wake with the place",
          kind: first ? "Travel" : "Pause",
          description: first
            ? "Arrive in " +
              place +
              ", leave the bags and take time for breakfast before beginning the day."
            : "Begin with breakfast and a quiet walk in " +
              place +
              ". Keep the morning flexible and check local conditions before heading out.",
        },
        {
          time: "09:30",
          title: activity,
          kind: "Explore",
          description:
            day.description +
            " Follow local guidance and take an unhurried pace; allow time for photographs and small detours.",
        },
        {
          time: "12:30",
          title: "A table, a pause, a view",
          kind: "Pause",
          description:
            "Pause for lunch near " +
            place +
            ". Carry drinking water and leave enough time to rest before the afternoon.",
        },
        {
          time: "15:00",
          title: last
            ? "One last look around"
            : index % 2
              ? "Follow a different lane"
              : "Stay for the afternoon light",
          kind: last ? "Travel" : "Explore",
          description: last
            ? "Revisit a favourite stop, collect your bags and allow a generous buffer for onward transport."
            : "Spend the afternoon on " +
              expedition.activities[
                (index + 1) % expedition.activities.length
              ] +
              ". Keep the plan optional if weather, opening hours or energy levels change.",
        },
        {
          time: "18:30",
          title: last ? "Carry the day with you" : "Settle in for the evening",
          kind: last ? "Travel" : "Stay",
          description: last
            ? "Leave time for the final connection. This is an example schedule; confirm actual departure times independently."
            : "Return to your example stay in " +
              place +
              ", have dinner and prepare for tomorrow. Keep the evening open for conversation and a little stillness.",
        },
      ],
    };
  });
}
/** Synthetic display geometry, not a record of a person's travel or road-routing instructions. */
export function sampleJourneyRoute(expedition: Expedition) {
  const places = expedition.destinationIds
    .map((id) => destinations.find((d) => d.id === id))
    .filter((d) => !!d);
  const center = places[0] ?? destinations[0];
  const same = places.every(
    (d) => d.latitude === center.latitude && d.longitude === center.longitude,
  );
  const anchors =
    same || places.length < 2
      ? [
          {
            latitude: center.latitude - 0.025,
            longitude: center.longitude - 0.035,
          },
          {
            latitude: center.latitude - 0.008,
            longitude: center.longitude - 0.011,
          },
          {
            latitude: center.latitude + 0.006,
            longitude: center.longitude + 0.018,
          },
        ]
      : places.map((d) => ({ latitude: d.latitude, longitude: d.longitude }));
  const points = anchors.flatMap((a, i) => {
    const b = anchors[i + 1];
    if (!b) return [a];
    return Array.from({ length: 32 }, (_, j) => {
      const t = j / 32,
        wiggle = Math.sin(t * Math.PI * 4) * Math.sin(t * Math.PI);
      const scale = Math.min(
        0.009,
        Math.max(
          0.002,
          Math.hypot(b.latitude - a.latitude, b.longitude - a.longitude) * 0.08,
        ),
      );
      return {
        latitude: a.latitude + (b.latitude - a.latitude) * t + wiggle * scale,
        longitude:
          a.longitude +
          (b.longitude - a.longitude) * t +
          Math.sin(t * Math.PI * 6) * Math.sin(t * Math.PI) * scale,
      };
    });
  });
  return { legs: [{ coordinates: points }], illustrative: true as const };
}
