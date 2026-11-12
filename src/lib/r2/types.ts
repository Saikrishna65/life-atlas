/** Native R2 records are separate from all existing vault/cloud databases. */
export type BucketSlot = "public" | "private";
export interface BucketSummary {
  slot: BucketSlot;
  configured: boolean;
  accountId?: string;
  endpoint?: string;
  bucket?: string;
  publicBaseUrl?: string;
  revision?: string;
}
export interface StorageSummary {
  supported: boolean;
  hardwareBacked: boolean;
  recoveryVerified: boolean;
  keyId: string;
  public: BucketSummary;
  private: BucketSummary;
}
export interface ConfigurationInput {
  slot: BucketSlot;
  accountId: string;
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl: string;
}
export interface SelectedMedia {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  persistent: boolean;
}
export interface CloudObject {
  key: string;
  size: number;
  modifiedAt: string;
  etag: string;
}
export interface ObjectPage {
  objects: CloudObject[];
  cursor: string;
  complete: boolean;
}
export type TransferStatus =
  | "queued"
  | "preparing"
  | "uploading"
  | "downloading"
  | "verifying"
  | "complete"
  | "failed"
  | "paused"
  | "interrupted"
  | "cancelling"
  | "cancelled";
export interface Transfer {
  id: string;
  slot: BucketSlot;
  key: string;
  name: string;
  mimeType: string;
  size?: number;
  totalBytes?: number;
  uploadedBytes?: number;
  status: TransferStatus;
  error?: string;
  createdAt: number;
  updatedAt?: number;
  speed?: number;
  eta?: number;
  publicUrl?: string;
  thumbnailUrl?: string;
  verified?: boolean;
  direction: "upload" | "download";
}
export interface ObjectMetadata {
  key: string;
  size: number;
  mimeType: string;
  etag: string;
  sha256: string;
  name?: string;
  encryption?: string;
}
export type MediaPlacement =
  | "destination"
  | "expedition"
  | "gallery"
  | "memory"
  | "cinematic"
  | "music-artwork"
  | "atlas-visual";
export interface PublishedMedia {
  id: string;
  key: string;
  url: string;
  title: string;
  description: string;
  tags: string[];
  category: MediaPlacement;
  collection: string;
  mimeType: string;
  size: number;
  publishedAt: string;
  thumbnailUrl?: string;
  metadataPolicy: "retained" | "removed";
}
export interface PublicMediaCatalog {
  format: "life-atlas-public-media";
  version: 1;
  revision: string;
  updatedAt: string;
  items: PublishedMedia[];
}
export interface PublishInput {
  transferId: string;
  title: string;
  description: string;
  tags: string[];
  category: MediaPlacement;
  collection: string;
  acknowledgeMetadata: boolean;
}
