"use client";
import { R2, nativeR2Available, systemAction } from "@/lib/r2/native";
export function deviceMediaId(id: string) {
  return /^(image|video):[a-zA-Z0-9_-]+:[0-9]+$/.test(id);
}
export async function shareDevice(ids: string[]) {
  if (!nativeR2Available() || ids.some((id) => !deviceMediaId(id)))
    throw new Error(
      "Open these originals in Atlas Photos on Android to share them.",
    );
  await systemAction(() => R2.shareDeviceMedia({ ids }));
}
export async function editDevice(id: string) {
  return systemAction(() => R2.editDeviceMedia({ id }));
}
export async function setDevicePhotoAs(id: string) {
  return systemAction(() => R2.setDeviceMediaAs({ id }));
}
