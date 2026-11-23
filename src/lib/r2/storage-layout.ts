import type { BucketSlot, CloudObject, ObjectPage } from "./types";
export type CloudObjectRole = "original" | "preview" | "system";
/** Existing keys remain valid. Organisation belongs in versioned records, not filenames. */
export function cloudObjectRole(
  slot: BucketSlot,
  key: string,
): CloudObjectRole {
  if (key.startsWith("atlas/catalog/") || key.startsWith("encrypted/catalog/"))
    return "system";
  if (
    key.startsWith("galleries/previews/") ||
    key.startsWith("encrypted/previews/")
  )
    return "preview";
  // An encrypted object must never be offered as a public original.
  if (slot === "public" && key.startsWith("encrypted/")) return "system";
  return "original";
}
export interface CloudListing {
  objects: CloudObject[];
  prefix: string;
  cursor: string;
  complete: boolean;
  loaded: boolean;
}
export const emptyCloudListing = (): CloudListing => ({
  objects: [],
  prefix: "",
  cursor: "",
  complete: false,
  loaded: false,
});
/** A continuation token only belongs to its bucket and the prefix that produced it. */
export function cloudPageRequest(
  listing: CloudListing,
  draft: string,
  more: boolean,
) {
  if (more && (!listing.loaded || !listing.cursor || listing.complete))
    throw Error("There is no next page. Refresh this folder first.");
  return {
    prefix: more ? listing.prefix : draft.trim(),
    cursor: more ? listing.cursor : "",
  };
}
export function mergeCloudPage(
  previous: CloudListing,
  page: ObjectPage,
  prefix: string,
  more: boolean,
): CloudListing {
  if (more && previous.prefix !== prefix)
    throw Error("This folder changed. Refresh it before loading more.");
  const objects = new Map<string, CloudObject>();
  for (const object of [...(more ? previous.objects : []), ...page.objects])
    objects.set(object.key, object);
  return {
    objects: [...objects.values()],
    prefix,
    cursor: page.cursor,
    complete: page.complete,
    loaded: true,
  };
}
