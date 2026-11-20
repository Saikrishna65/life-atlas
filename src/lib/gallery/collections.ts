import type { DeviceMedia, DevicePage } from "./types";
export type CollectionKind = "similar" | "people" | "memories";
export interface SmartCollection {
  id: string;
  kind: "similar" | "people" | "memory" | "album";
  title: string;
  subtitle: string;
  count: number;
  coverId: string;
  faceId?: string;
  confirmed?: boolean;
  suggestedPersonId?: string;
  bestId?: string;
  pickedId?: string;
}
export interface CollectionPage {
  collections: SmartCollection[];
  cursor: string;
  complete: boolean;
  partial: boolean;
  needsAnalysis: boolean;
  hiddenMemories?: number;
  analysisState: string;
}
export interface CollectionMediaPage extends DevicePage {
  bestId?: string;
  pickedId?: string;
}
export interface PeopleFacePage {
  faces: { id: string; mediaId: string }[];
  media: DeviceMedia[];
  people: { id: string; name: string }[];
  cursor: string;
  complete: boolean;
}
export type CollectionEdit =
  | { action: "pick" | "separate-photo"; key: string; mediaId: string }
  | { action: "dismiss-similar" | "hide-memory"; key: string }
  | { action: "name-person"; key: string; name: string }
  | { action: "confirm-person-match"; key: string; personId: string }
  | { action: "assign-face"; key: string; faceId: string; personId: string }
  | { action: "separate-face" | "exclude-face"; key: string; faceId: string }
  | { action: "forget-people" | "reset-similar" | "restore-memories" };
