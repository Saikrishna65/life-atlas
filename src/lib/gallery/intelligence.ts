/** Derived on-device search only. Neither OCR nor vectors enter app backups or public catalogs. */
export interface GalleryIntelligenceSettings {
  ocr: boolean;
  visual: boolean;
  similar?: boolean;
  people?: boolean;
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
  peopleModelReady?: boolean;
  peopleModelBytes?: number;
  downloadTarget?: "people" | "visual";
  waitReason?: "heat" | "battery-saver" | "battery" | "memory" | "";
}
export const defaultIntelligenceSettings: GalleryIntelligenceSettings = {
  ocr: true,
  visual: false,
  similar: true,
  people: false,
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
      if (status.waitReason === "heat")
        return "Taking a break while your phone cools down";
      if (status.waitReason === "battery-saver")
        return "Paused while Battery Saver is on";
      if (status.waitReason === "battery")
        return "Waiting for charging or more than 20% battery";
      if (status.waitReason === "memory")
        return "Taking a break while your phone needs memory";
      return status.chargingOnly
        ? "Waiting for charging and enough battery"
        : "Waiting for enough battery and storage";
    case "downloading":
      return status.downloadTarget === "people"
        ? "Downloading the small people-grouping models"
        : "Downloading visual search model";
    case "indexing":
      return "Analyzing photos on this phone";
    case "ready":
      return status.failed > 0
        ? `Analysis finished · ${status.failed} photos need another try`
        : "Up to date";
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
