import type {
  DeviceMedia,
  GalleryAssignment,
  GalleryAsset,
  StatusFilter,
} from "./types";
import type {
  Transfer,
  CloudObject,
  BucketSlot,
  BucketSummary,
} from "../r2/types";
import type { TripRecord } from "../vault/types";
export const mediaStamp = (media: DeviceMedia) =>
  `${media.size}:${media.modifiedAt}${media.generation && media.generation > 0 ? `:${media.generation}` : ""}`;
export function deviceTransfer(media: DeviceMedia, jobs: Transfer[]) {
  return jobs
    .filter(
      (job) =>
        job.direction === "upload" &&
        job.galleryId === media.id &&
        job.sourceStamp === mediaStamp(media),
    )
    .sort((a, b) => b.createdAt - a.createdAt)[0];
}
export function deviceAsset(
  media: DeviceMedia,
  jobs: Transfer[],
): GalleryAsset {
  return {
    id: media.id,
    name: media.name,
    kind: media.kind,
    size: media.size,
    date: media.addedAt,
    mimeType: media.mimeType,
    url: media.uri,
    device: media,
    transfer: deviceTransfer(media, jobs),
  };
}
export function cloudAsset(
  object: CloudObject,
  slot: BucketSlot,
  base: string,
  jobs: Transfer[],
  bucket?: BucketSummary,
): GalleryAsset {
  const job = jobs
    .filter(
      (j) =>
        j.slot === slot &&
        j.key === object.key &&
        j.status === "complete" &&
        j.direction === "upload" &&
        (!bucket ||
          (j.storageScope
            ? j.storageScope === bucket.storageScope
            : j.revision === bucket.revision)),
    )
    .sort((a, b) => b.createdAt - a.createdAt)[0];
  return {
    id: `${slot}:${bucket?.storageScope || bucket?.revision || base}:${object.key}`,
    key: object.key,
    slot,
    size: object.size,
    date: Date.parse(object.modifiedAt),
    mimeType: job?.mimeType || "",
    name: job?.name || object.key.split("/").pop() || "Cloud file",
    kind: job?.mimeType.startsWith("video/")
      ? "video"
      : job?.mimeType.startsWith("image/")
        ? "photo"
        : "unknown",
    url:
      slot === "public" && base
        ? `${base}/${object.key.split("/").map(encodeURIComponent).join("/")}`
        : undefined,
    thumbnail: job?.thumbnailUrl,
    transfer: job,
  };
}
export function assignmentFor(
  media: DeviceMedia,
  assignments: GalleryAssignment[],
) {
  return assignments.filter(
    (a) => a.deviceId === media.id && a.sourceStamp === mediaStamp(media),
  );
}
export function publishedAsset(asset: GalleryAsset, trips: TripRecord[]) {
  const keys = [
    asset.key,
    asset.transfer?.key,
    ...Object.values(asset.device?.copies || {})
      .filter((c) => c.state === "verified")
      .map((c) => c.key),
  ].filter(Boolean);
  return trips.some(
    (trip) =>
      trip.publishedSlug &&
      (trip.websitePlaces || []).some((place) =>
        place.publishedMedia.some(
          (item) =>
            keys.includes(item.key) &&
            (trip.websitePublishedMediaIds || []).includes(item.id),
        ),
      ),
  );
}
export function statusLabel(asset: GalleryAsset, trips: TripRecord[]) {
  if (
    Object.values(asset.device?.copies || {}).some(
      (c) => c.state === "missing",
    ) &&
    !Object.values(asset.device?.copies || {}).some(
      (c) => c.state === "verified",
    )
  )
    return "Cloud copy missing";
  if (publishedAsset(asset, trips)) return "Published on website";
  const job = asset.transfer;
  if (
    job &&
    [
      "queued",
      "preparing",
      "uploading",
      "verifying",
      "interrupted",
      "paused",
    ].includes(job.status)
  )
    return job.status === "paused"
      ? "Paused"
      : job.status === "queued"
        ? "Queued"
        : job.status === "verifying"
          ? "Verifying cloud bytes"
          : "Uploading";
  if (job?.status === "failed") return "Needs attention";
  if (asset.slot)
    return asset.slot === "private" ? "Private cloud" : "Public cloud";
  const verified = Object.entries(asset.device?.copies || {})
    .filter(([, value]) => value.state === "verified")
    .map(([slot]) => slot);
  if (verified.length)
    return verified.length === 2
      ? "Public + private cloud"
      : verified[0] === "private"
        ? "Private cloud verified"
        : "Public cloud verified";
  if (job?.status === "complete" && job.verified)
    return `${job.slot === "private" ? "Private" : "Public"} copy recorded`;
  if (
    Object.values(asset.device?.copies || {}).some(
      (c) => c.state === "not-found",
    )
  )
    return "No matching known upload";
  if (
    Object.values(asset.device?.copies || {}).some(
      (c) => c.state === "unavailable",
    )
  )
    return "Cloud check unavailable";
  return "Not checked";
}
export function matchesStatus(
  asset: GalleryAsset,
  status: StatusFilter,
  trips: TripRecord[],
) {
  if (status === "all") return true;
  const label = statusLabel(asset, trips);
  if (status === "published") return publishedAsset(asset, trips);
  if (status === "pending")
    return ["Uploading", "Queued", "Paused", "Verifying cloud bytes"].includes(
      label,
    );
  if (status === "failed")
    return (
      label === "Needs attention" ||
      label === "Cloud copy missing" ||
      label === "Cloud check unavailable"
    );
  if (status === "unchecked") return label === "Not checked";
  if (status === "not-found") return label === "No matching known upload";
  return (
    label !== "Cloud copy missing" &&
    (/cloud|copy recorded/i.test(label) || label === "Published on website")
  );
}
/** Trip relationships are local organization, not proof of website publication. */
export function assetAssignments(
  asset: GalleryAsset,
  records: GalleryAssignment[],
  trips: TripRecord[],
): GalleryAssignment[] {
  const assigned = asset.device
    ? assignmentFor(asset.device, records).filter((a) =>
        trips.some(
          (t) =>
            t.id === a.tripId &&
            t.websitePlaces?.some((p) => p.id === a.placeId),
        ),
      )
    : [];
  const keys = [
    asset.key,
    asset.transfer?.key,
    ...Object.values(asset.device?.copies || {})
      .filter((c) => c.state === "verified")
      .map((c) => c.key),
  ].filter(Boolean);
  for (const trip of trips)
    for (const place of trip.websitePlaces || [])
      if (
        place.publishedMedia.some((m) => keys.includes(m.key)) ||
        (!!asset.transfer &&
          Object.values(place.transferIds).includes(asset.transfer.id))
      ) {
        if (
          !assigned.some((a) => a.tripId === trip.id && a.placeId === place.id)
        )
          assigned.push({
            id: `linked-${trip.id}-${place.id}`,
            deviceId: asset.id,
            sourceStamp: asset.device ? mediaStamp(asset.device) : "",
            tripId: trip.id,
            placeId: place.id,
            createdAt: "",
          });
      }
  return assigned;
}
export function currentBucketTransfers(
  jobs: Transfer[],
  summary?: import("../r2/types").StorageSummary,
) {
  return jobs.filter(
    (job) =>
      summary?.[job.slot].configured &&
      (job.storageScope
        ? job.storageScope === summary[job.slot].storageScope
        : job.revision === summary[job.slot].revision),
  );
}
