import type { DeviceMedia, DevicePage } from "./types";
export type CollectionKind = "similar" | "people" | "memories" | "albums";
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
  hiddenPeople?: number;
  canUndoPeople?: boolean;
  analysisState: string;
  matches?: PeopleMatch[];
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
export interface PeopleMatch {
  id: string;
  left: string;
  right: string;
  leftName: string;
  rightName: string;
  leftFace: string;
  rightFace: string;
}
export type CollectionEdit =
  | {
      action: "confirm-people-pair";
      keys: string[];
      name: string;
      personId?: string;
    }
  | { action: "reject-people-match"; key: string }
  | { action: "merge-people-many"; keys: string[]; personId: string }
  | { action: "pick" | "separate-photo"; key: string; mediaId: string }
  | { action: "dismiss-similar" | "hide-memory"; key: string }
  | { action: "name-person"; key: string; name: string }
  | { action: "confirm-person-match"; key: string; personId: string }
  | { action: "assign-face"; key: string; faceId: string; personId: string }
  | { action: "separate-face" | "exclude-face"; key: string; faceId: string }
  | { action: "merge-people"; key: string; personId: string }
  | { action: "hide-person"; key: string }
  | { action: "person-cover"; key: string; faceId: string }
  | { action: "undo-people" | "restore-people" }
  | { action: "forget-people" | "reset-similar" | "restore-memories" };

export interface GalleryRecoveryStatus {
  enabled?: boolean;
  state?: string;
  processed?: number;
  total?: number;
  matched?: number;
  unmatched?: number;
  error?: string;
  lastSaved?: number;
  lastRestored?: number;
}

export interface AlbumEdit {
  action: "create" | "rename" | "add" | "remove" | "cover" | "move" | "delete";
  id?: string;
  name?: string;
  ids?: string[];
  cover?: string;
  direction?: number;
}
