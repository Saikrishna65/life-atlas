/** Derived on-device search only. Neither OCR nor vectors enter app backups or public catalogs. */
export interface GalleryIntelligenceSettings {
  ocr: boolean;
  visual: boolean;
  chargingOnly: boolean;
  wifiOnly: boolean;
  /** Empty means every album the phone permission allows. */
  albums: string[];
}
export interface GalleryIntelligenceStatus extends GalleryIntelligenceSettings {
  enabled: boolean;
  state:
    | "off"
    | "waiting"
    | "downloading"
    | "indexing"
    | "ready"
    | "paused"
    | "error";
  indexed: number;
  scanned: number;
  failed: number;
  error: string;
  updatedAt: number;
  modelReady: boolean;
  modelBytes: number;
}
export const defaultIntelligenceSettings: GalleryIntelligenceSettings = {
  ocr: true,
  visual: false,
  chargingOnly: true,
  wifiOnly: true,
  albums: [],
};
export function intelligenceStateText(
  status: GalleryIntelligenceStatus,
): string {
  switch (status.state) {
    case "off":
      return "Not enabled";
    case "waiting":
      return status.chargingOnly
        ? "Waiting for charging and enough battery"
        : "Waiting for enough battery and storage";
    case "downloading":
      return "Downloading visual search model";
    case "indexing":
      return "Analyzing photos on this phone";
    case "ready":
      return "Up to date";
    case "paused":
      return "Paused · your search index is kept";
    case "error":
      return status.error === "permission"
        ? "Photo access changed. Check Android permissions, then resume."
        : status.error === "download"
          ? "Model download couldn’t finish. Check your connection, then resume."
          : "Analysis stopped. Resume to try again.";
  }
}
