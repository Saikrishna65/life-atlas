export interface BackupSettings {
  enabled: boolean;
  photos: boolean;
  videos: boolean;
  albums: string[];
  wifiOnly: boolean;
  chargingOnly: boolean;
  includeExisting: boolean;
  videoPreviews: boolean;
  error?: string;
  lastScan?: number;
  lastQueued?: number;
}
export const defaultBackup: BackupSettings = {
  enabled: false,
  photos: true,
  videos: true,
  albums: [],
  wifiOnly: true,
  chargingOnly: false,
  includeExisting: true,
  videoPreviews: false,
};
export interface LibraryItem {
  id: string;
  name: string;
  slot: "private" | "public";
  scope: string;
  state: "active" | "trashed" | "deleted" | "conflict";
  kind: "photo" | "video";
  mimeType: string;
  size: number;
  totalBytes: number;
  changed: number;
  verifiedAt: number;
  capturedAt?: number;
  trashAt?: number;
  expiresAt?: number;
  cleanupPending?: boolean;
  conflicted?: boolean;
  hasThumbnail?: boolean;
  hasClip?: boolean;
  previewError?: string;
  takeout?: {
    title?: string;
    description?: string;
    capturedAt?: number;
    gps?: { latitude: number; longitude: number };
    albums?: string[];
  };
}
export interface ImportJob {
  id: string;
  name: string;
  status: "selected" | "queued" | "running" | "paused" | "failed" | "complete";
  files: number;
  bytes?: number;
  currentFile?: string;
  error?: string;
}
export interface LibraryStatus {
  importSummary?: { files: number; unmatched: number };
  backupTransfers?: { active: number; failed: number };
  androidSdk: number;
  trashDays: number;
  autoBackup: BackupSettings;
  task: {
    status?: string;
    action?: string;
    processed?: number;
    error?: string;
  };
  imports: ImportJob[];
}
export interface LibraryPage {
  items: LibraryItem[];
  offset: number;
  complete: boolean;
  counts: Record<string, number>;
}
export function validateBackupSettings(settings: BackupSettings) {
  if (!settings.photos && !settings.videos)
    throw Error("Choose photos, videos, or both.");
  if (settings.enabled && !settings.albums.length)
    throw Error("Select at least one device album.");
  return settings;
}
export function importProgress(job: ImportJob) {
  return job.status === "complete"
    ? `${job.files} media entries processed`
    : job.currentFile
      ? `${job.currentFile} · ${job.files} processed`
      : job.status;
}
