import type { TripRecord } from "../vault/types";
export interface GallerySearchIntent {
  text: string;
  from?: string;
  to?: string;
  kind?: "photo" | "video";
  favorites?: boolean;
  tripId?: string;
  placeId?: string;
  personId?: string;
  labels: string[];
}
const months = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];
const iso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
/** Small, deterministic parser. Uses only names already saved by the owner; never geocodes guesses. */
export function gallerySearchIntent(
  query: string,
  trips: Pick<TripRecord, "id" | "title" | "websitePlaces">[],
  now = new Date(),
  people: { id: string; name: string }[] = [],
): GallerySearchIntent {
  let text = query.trim().toLowerCase();
  const result: GallerySearchIntent = { text: query, labels: [] };
  const take = (value: string) => {
    const start = text.indexOf(value.toLowerCase());
    if (start >= 0)
      text = text.slice(0, start) + " " + text.slice(start + value.length);
  };
  const contains = (value: string) => {
    const index = text.indexOf(value.toLowerCase());
    return (
      index >= 0 &&
      !/[\p{L}\p{N}]/u.test(text[index - 1] || " ") &&
      !/[\p{L}\p{N}]/u.test(text[index + value.length] || " ")
    );
  };
  const trip = [...trips]
    .sort((a, b) => b.title.length - a.title.length)
    .find((t) => t.title.trim().length > 2 && contains(t.title));
  if (trip) {
    result.tripId = trip.id;
    result.labels.push(trip.title);
    take(trip.title);
  }
  const places = (trip ? [trip] : trips)
    .flatMap((t) =>
      (t.websitePlaces || []).map((p) => ({ ...p, tripId: t.id })),
    )
    .filter((p) => p.name.trim().length > 2 && contains(p.name))
    .sort((a, b) => b.name.length - a.name.length);
  if (
    places.length &&
    places.filter((p) => p.name.toLowerCase() === places[0].name.toLowerCase())
      .length === 1
  ) {
    const p = places[0];
    result.tripId = p.tripId;
    result.placeId = p.id;
    result.labels.push(p.name);
    take(p.name);
  }
  const matchedPeople = people
    .filter((p) => p.name.trim().length > 1 && contains(p.name))
    .sort((a, b) => b.name.length - a.name.length);
  if (
    matchedPeople.length &&
    matchedPeople.filter(
      (p) => p.name.toLowerCase() === matchedPeople[0].name.toLowerCase(),
    ).length === 1
  ) {
    const person = matchedPeople[0];
    result.personId = person.id;
    result.labels.push(person.name);
    take(person.name);
  }
  const relative = text.match(/\b(this|last)\s+(month|year)\b/);
  const date = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  const month = text.match(
    new RegExp(
      `\\b(${months.join("|")}|${months.map((m) => m.slice(0, 3)).join("|")})\\s+(20\\d{2})\\b`,
    ),
  );
  const year = text.match(/\b(20\d{2})\b/);
  let from: Date | undefined,
    to: Date | undefined,
    token = "";
  if (relative) {
    const y =
        now.getFullYear() -
        (relative[2] === "year" && relative[1] === "last" ? 1 : 0),
      m =
        relative[2] === "month"
          ? now.getMonth() - (relative[1] === "last" ? 1 : 0)
          : 0;
    from = new Date(y, m, 1);
    to = new Date(y, relative[2] === "month" ? m + 1 : 12, 0);
    token = relative[0];
  } else if (date) {
    const y = +date[1],
      m = +date[2] - 1,
      d = +date[3];
    const parsed = new Date(y, m, d);
    if (
      parsed.getFullYear() === y &&
      parsed.getMonth() === m &&
      parsed.getDate() === d
    ) {
      from = parsed;
      to = parsed;
      token = date[0];
    }
  } else if (month) {
    const m = months.findIndex((v) => v.startsWith(month[1]));
    from = new Date(+month[2], m, 1);
    to = new Date(+month[2], m + 1, 0);
    token = month[0];
  } else if (year) {
    from = new Date(+year[1], 0, 1);
    to = new Date(+year[1], 11, 31);
    token = year[0];
  }
  if (from && to) {
    result.from = iso(from);
    result.to = iso(to);
    result.labels.push(token);
    take(token);
  }
  const video = /\bvideos?|films?\b/,
    photo = /\bphotos?|pictures?|images?\b/;
  if (video.test(text)) {
    result.kind = "video";
    text = text.replace(video, " ");
    result.labels.push("Videos");
  } else if (photo.test(text)) {
    result.kind = "photo";
    text = text.replace(photo, " ");
    result.labels.push("Photos");
  }
  if (/\bfavou?rites?\b/.test(text)) {
    result.favorites = true;
    text = text.replace(/\bfavou?rites?\b/, " ");
    result.labels.push("Favourites");
  }
  if (result.personId) text = text.replace(/\bwith\b/g, " ");
  result.text = result.labels.length
    ? text
        .replace(/\b(from|in|at|during|my|the|of|on)\b/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    : query.trim();
  return result;
}
