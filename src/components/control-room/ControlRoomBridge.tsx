"use client";
import { useEffect } from "react";
import { getControlSettings } from "@/lib/control-room/store";
import { lazyService } from "@/lib/performance/lazy-service";
function automaticCloudEnabled() {
  try {
    const link = JSON.parse(localStorage.getItem("atlas_cloud_connection_v1") || "null");
    return link?.ready === true && link?.automatic === true;
  } catch { return false; }
}
export default function ControlRoomBridge() {
  useEffect(() => {
    let active = true;
    void getControlSettings().then(settings => {
      if (active) localStorage.setItem("atlas-control-preferences", JSON.stringify(settings));
    }).catch(() => {});
    const service = lazyService(automaticCloudEnabled, async () => {
      const cloud = await import("@/lib/cloud-vault/client");
      return cloud.beginAutomaticCloudSync;
    });
    service.refresh();
    window.addEventListener("atlas-cloud-link", service.refresh);
    window.addEventListener("online", service.refresh);
    window.addEventListener("storage", service.refresh);
    return () => {
      active = false; service.dispose();
      window.removeEventListener("atlas-cloud-link", service.refresh);
      window.removeEventListener("online", service.refresh);
      window.removeEventListener("storage", service.refresh);
    };
  }, []);
  return null;
}
