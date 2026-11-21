import { Capacitor, registerPlugin } from "@capacitor/core";
export interface AppUpdate {
  packageId: string;
  versionCode: number;
  versionName: string;
  bytes: number;
  sha256: string;
  notes: string;
}
export interface UpdateStatus {
  installedVersion: string;
  installedCode: number;
  packageId: string;
  phase: "idle" | "checking" | "downloading" | "verifying" | "ready" | "error";
  error: string;
  downloadedBytes: number;
  update: AppUpdate | null;
  ready: boolean;
  canInstall: boolean;
  automaticChecks: boolean;
  wifiOnly: boolean;
  lastChecked: number;
  postponedVersion: number;
}
export const supportsUpdates = () =>
  Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("AtlasUpdates");
export const Updates = registerPlugin<{
  getStatus(): Promise<UpdateStatus>;
  check(options: { automatic?: boolean }): Promise<UpdateStatus>;
  configure(options: {
    automaticChecks?: boolean;
    wifiOnly?: boolean;
    later?: boolean;
  }): Promise<UpdateStatus>;
  download(options: { consent: boolean }): Promise<UpdateStatus>;
  install(options: { consent: boolean }): Promise<UpdateStatus>;
  cancel(): Promise<void>;
}>("AtlasUpdates");
export function showAppUpdates() {
  window.dispatchEvent(new Event("atlas:updates-open"));
}
