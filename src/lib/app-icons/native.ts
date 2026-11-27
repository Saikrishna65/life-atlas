import { Capacitor, registerPlugin } from "@capacitor/core";
import type { IconModule, IconStyle, IconShape } from "./design";
export interface SavedIconDesign { style: IconStyle; shape: IconShape; color: string; source: "photo" | "preset"; }
export interface IconSummary { module: IconModule; label: string; custom: boolean; installed: boolean; supported: boolean; pngBase64?: string; design?: SavedIconDesign; updated?: boolean; }
export const supportsAppIcons = () => Capacitor.getPlatform() === "android" && Capacitor.isPluginAvailable("AtlasIcons");
export const AppIcons = registerPlugin<{
  getSettings(): Promise<{ supported: boolean; apps: IconSummary[] }>;
  getIcon(options: { module: IconModule }): Promise<IconSummary>;
  saveIcon(options: { module: IconModule; label: string; pngBase64: string; design: SavedIconDesign }): Promise<IconSummary>;
  pinIcon(options: { module: IconModule }): Promise<{ supported: boolean; requested: boolean; updated: boolean }>;
  resetIcon(options: { module: IconModule }): Promise<IconSummary>;
}>("AtlasIcons");
