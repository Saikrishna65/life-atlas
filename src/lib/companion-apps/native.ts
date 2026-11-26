import { Capacitor, registerPlugin } from "@capacitor/core";
import type { CompanionStatus } from "./catalogue";
export const supportsCompanionApps = () =>
  Capacitor.getPlatform() === "android" &&
  Capacitor.isPluginAvailable("AtlasApps");
export const CompanionApps = registerPlugin<{
  getStatus(): Promise<CompanionStatus>;
  check(): Promise<CompanionStatus>;
  configure(options: { wifiOnly: boolean }): Promise<CompanionStatus>;
  download(options: { consent: boolean }): Promise<CompanionStatus>;
  install(options: { consent: boolean }): Promise<CompanionStatus>;
  cancel(): Promise<void>;
  openApp(): Promise<void>;
}>("AtlasApps");
