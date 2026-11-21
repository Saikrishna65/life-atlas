import {
  CloudCheck,
  CloudOff,
  CloudUpload,
  CloudAlert,
  Smartphone,
  Globe,
  Cloud,
} from "lucide-react";
import type { GalleryAsset } from "@/lib/gallery/types";
/** A cloud-only claim needs a complete local scan; absence from the visible grid isn't proof. */
export function backupBadge(asset: GalleryAsset) {
  if (!asset.device) return { label: "Cloud copy", state: "cloud" };
  const job = asset.transfer,
    copies = asset.device.copies;
  if (job && ["failed", "paused", "interrupted"].includes(job.status))
    return {
      label:
        job.status === "paused" ? "Upload paused" : "Upload needs attention",
      state: "attention",
    };
  if (
    job &&
    ["queued", "uploading", "waiting", "preparing", "verifying"].includes(
      job.status,
    )
  )
    return { label: "Waiting to finish backup", state: "uploading" };
  if (
    copies?.private?.state === "verified" ||
    (job?.slot === "private" && job.status === "complete" && job.verified)
  )
    return { label: "Backed up privately", state: "backed-up" };
  if (
    copies?.public?.state === "verified" ||
    (job?.slot === "public" && job.status === "complete" && job.verified)
  )
    return { label: "Public cloud copy", state: "public" };
  if (
    copies?.private?.state === "missing" ||
    copies?.private?.state === "unavailable"
  )
    return { label: "Check private backup", state: "attention" };
  if (
    copies?.private?.state === "not-found" &&
    copies?.public?.state === "not-found"
  )
    return { label: "On this phone · no known cloud copy", state: "phone" };
  return {
    label: "On this phone · cloud status not checked",
    state: "unchecked",
  };
}
export default function GalleryBackupBadge({ asset }: { asset: GalleryAsset }) {
  const badge = backupBadge(asset),
    Icon =
      badge.state === "backed-up"
        ? CloudCheck
        : badge.state === "public"
          ? Globe
          : badge.state === "uploading"
            ? CloudUpload
            : badge.state === "attention"
              ? CloudAlert
              : badge.state === "cloud"
                ? Cloud
                : badge.state === "phone"
                  ? CloudOff
                  : Smartphone;
  return (
    <span
      className="pg-backup-badge"
      data-state={badge.state}
      aria-label={badge.label}
      title={badge.label}
    >
      <Icon size={13} />
      <span className="sr-only">{badge.label}</span>
    </span>
  );
}
