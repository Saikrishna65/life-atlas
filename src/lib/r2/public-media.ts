import type { PublishedMedia } from "./types";

/** Publishing collection accepts the exact public trip slug or title. No fuzzy matches. */
export function mediaForTrip(
  items: PublishedMedia[],
  slug: string,
  title: string,
) {
  const normalize = (value: string) =>
    value.trim().normalize("NFC").toLocaleLowerCase("en");
  const names = new Set([normalize(slug), normalize(title)]);
  return items.filter(
    (item) =>
      item.category === "expedition" &&
      names.has(normalize(item.collection)) &&
      (item.mimeType.startsWith("image/") ||
        item.mimeType.startsWith("video/")),
  );
}
export function mediaKind(mimeType: string): "photo" | "video" {
  return mimeType.startsWith("video/") ? "video" : "photo";
}
