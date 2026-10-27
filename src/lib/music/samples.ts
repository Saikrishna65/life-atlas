/**
 * Life Atlas Music Vault - Samples Registry
 * Curated default nature/adventure samples removed completely per user request.
 */

import { MusicTrack } from "./types";

export const SAMPLE_DEFAULT_TRACK_TITLES: readonly string[] = [
  "Mountain Pass Horizon",
  "Nocturne across Pine Valleys",
  "Desert Twilight Roadtrip",
  "High Altitude Solitude",
];

export const CURATED_EXPEDITION_SAMPLES: Omit<MusicTrack, "id" | "addedAt">[] = [];
