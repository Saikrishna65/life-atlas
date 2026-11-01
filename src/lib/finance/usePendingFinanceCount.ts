"use client";

import { useEffect, useState } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { KotakNotificationParser } from "./infrastructure/kotakNotificationParser";
import type { RawNotificationEvent } from "./domain/notificationModels";

interface InboxPlugin {
  getPendingNotifications(): Promise<{ notifications: RawNotificationEvent[] }>;
  addListener(name: "notificationReceived", callback: () => void): Promise<{ remove(): void }>;
}

export function usePendingFinanceCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!Capacitor.isPluginAvailable("KotakNotificationTracker")) return;
    const plugin = registerPlugin<InboxPlugin>("KotakNotificationTracker");
    let alive = true;
    const refresh = async () => {
      try {
        const { notifications } = await plugin.getPendingNotifications();
        const fingerprints = new Set(notifications.flatMap((event) => {
          const parsed = KotakNotificationParser.parse(event).transaction;
          return parsed ? [parsed.normalizedFingerprint] : [];
        }));
        if (alive) setCount(fingerprints.size);
      } catch { /* Older APKs do not expose the inbox. */ }
    };
    const visible = () => { if (document.visibilityState === "visible") void refresh(); };
    const listener = plugin.addListener("notificationReceived", refresh);
    window.addEventListener("finance-notifications-updated", refresh);
    window.addEventListener("focus", visible);
    document.addEventListener("visibilitychange", visible);
    const timer = window.setInterval(visible, 10000);
    void refresh();
    return () => {
      alive = false;
      window.clearInterval(timer);
      window.removeEventListener("finance-notifications-updated", refresh);
      window.removeEventListener("focus", visible);
      document.removeEventListener("visibilitychange", visible);
      void listener.then((handle) => handle.remove());
    };
  }, []);
  return count;
}
