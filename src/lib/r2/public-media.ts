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
  return items
    .filter(
      (item) =>
        (
          item.placements || [
            { category: item.category, collection: item.collection },
          ]
        ).some(
          (p) =>
            p.category === "expedition" && names.has(normalize(p.collection)),
        ) &&
        (item.mimeType.startsWith("image/") ||
          item.mimeType.startsWith("video/")),
    )
    .map((item) => {
      const place = item.placements?.find(
        (p) =>
          p.category === "expedition" &&
          names.has(normalize(p.collection)) &&
          p.placeName,
      );
      return place
        ? {
            ...item,
            tags: [
              ...item.tags.filter(
                (tag) =>
                  !tag.startsWith("place:") &&
                  !tag.startsWith("place-id:") &&
                  !tag.startsWith("library-place-id:"),
              ),
              `place:${place.placeName}`,
              ...(place.placeId ? [`place-id:${place.placeId}`] : []),
            ],
          }
        : item;
    });
}
export function mediaKind(mimeType: string): "photo" | "video" {
  return mimeType.startsWith("video/") ? "video" : "photo";
}
