import type { BucketSlot, Transfer } from "../r2/types";
export interface CloudCopy {
  state: "unchecked" | "not-found" | "verified" | "missing" | "unavailable";
  key?: string;
  thumbnailUrl?: string;
  checkedAt: number;
}
export interface DeviceMedia {
  id: string;
  name: string;
  kind: "photo" | "video";
  mimeType: string;
  size: number;
  addedAt: number;
  /** Camera capture time when MediaStore supplies it, in milliseconds. */
  capturedAt?: number;
  modifiedAt: number;
  generation?: number;
  width: number;
  height: number;
  duration: number;
  album: string;
  uri: string;
  copies?: Partial<Record<BucketSlot, CloudCopy>>;
}
export interface DevicePage {
  items: DeviceMedia[];
  cursor: string;
  complete: boolean;
}
export interface GalleryAccess {
  status: "full" | "limited" | "denied";
  images: boolean;
  videos: boolean;
  limited: boolean;
}
export interface GalleryAssignment {
  id: string;
  deviceId: string;
  sourceStamp: string;
  tripId: string;
  placeId: string;
  createdAt: string;
}
export interface GalleryAsset {
  id: string;
  name: string;
  kind: "photo" | "video" | "unknown";
  size: number;
  date: number;
  mimeType: string;
  url?: string;
  thumbnail?: string;
  device?: DeviceMedia;
  slot?: BucketSlot;
  key?: string;
  transfer?: Transfer;
}
export type StatusFilter =
  | "all"
  | "unchecked"
  | "not-found"
  | "cloud"
  | "pending"
  | "failed"
  | "published";
