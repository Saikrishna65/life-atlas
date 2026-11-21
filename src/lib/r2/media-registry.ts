import type { MediaPlacement, PublishedMedia } from "./types";
export interface PublicAssetReference {
  version: 1;
  id: string;
  key: string;
  originalUrl: string;
  previewUrl?: string;
  mimeType: string;
  bytes: number;
  placements: {
    category: MediaPlacement;
    collection: string;
    placeId?: string;
    placeName?: string;
  }[];
}
/** Project only explicitly public records. Never joins the encrypted private index into a web catalog. */
export function publicAssetRegistry(
  items: PublishedMedia[],
): PublicAssetReference[] {
  const registry = new Map<string, PublicAssetReference>();
  for (const item of items) {
    if (item.key.startsWith("encrypted/") || !/^https:\/\//.test(item.url))
      throw Error("A public asset is required");
    const relations = item.placements || [
      { category: item.category, collection: item.collection },
    ];
    const existing = registry.get(item.key);
    if (existing) {
      if (
        existing.originalUrl !== item.url ||
        existing.mimeType !== item.mimeType ||
        existing.bytes !== item.size
      )
        throw Error("Conflicting public asset records");
      for (const relation of relations)
        if (
          !existing.placements.some(
            (p) =>
              p.category === relation.category &&
              p.collection === relation.collection &&
              p.placeId === relation.placeId &&
              p.placeName === relation.placeName,
          )
        )
          existing.placements.push({ ...relation });
    } else
      registry.set(item.key, {
        version: 1,
        id: item.assetId || item.id,
        key: item.key,
        originalUrl: item.url,
        previewUrl: item.thumbnailUrl,
        mimeType: item.mimeType,
        bytes: item.size,
        placements: relations.map((p) => ({ ...p })),
      });
  }
  return [...registry.values()];
}
