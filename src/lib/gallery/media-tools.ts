import type { DeviceMedia } from "./types";
export interface PhotoRecipe {
  angle: number;
  aspect: number;
  zoom: number;
  x: number;
  y: number;
  brightness: number;
  contrast: number;
  flip: boolean;
}
export const originalRecipe: PhotoRecipe = {
  angle: 0,
  aspect: 0,
  zoom: 1,
  x: 0.5,
  y: 0.5,
  brightness: 1,
  contrast: 1,
  flip: false,
};
export interface GalleryViewerState {
  searchLabel?: string;
  position: number;
  cover: number;
  original?: DeviceMedia;
  recipe?: PhotoRecipe;
}
export interface GalleryMotion {
  embedded?: boolean;
  path?: string;
  companion?: DeviceMedia;
}
export interface GalleryCacheReport {
  bytes: number;
  files: number;
  limitMiB: number;
}
