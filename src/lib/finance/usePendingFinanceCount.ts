"use client";
import { useSyncExternalStore } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { SessionResource } from "../performance/session-resource";
import type { RawNotificationEvent } from "./domain/notificationModels";
interface InboxPlugin {
  getPendingNotifications(): Promise<{ notifications: RawNotificationEvent[] }>;
  addListener(
    name: "notificationReceived",
    callback: () => void,
  ): Promise<{ remove(): void }>;
}
// Cache only the number, never notification bodies or parsed financial records.
const pendingCount = new SessionResource(
  async () => {
    if (!Capacitor.isPluginAvailable("KotakNotificationTracker")) return 0;
    const [{ notifications }, { KotakNotificationParser }] = await Promise.all([
      registerPlugin<InboxPlugin>(
        "KotakNotificationTracker",
      ).getPendingNotifications(),
      import("./infrastructure/kotakNotificationParser"),
    ]);
    return new Set(
      notifications.flatMap((event) => {
        const parsed = KotakNotificationParser.parse(event).transaction;
        return parsed ? [parsed.normalizedFingerprint] : [];
      }),
    ).size;
  },
  0,
  "Unable to refresh pending payments.",
);
let users = 0;
let detach: (() => void) | undefined;
function subscribe(listener: () => void) {
  const unsubscribe = pendingCount.subscribe(listener);
  if (users++ === 0) {
    const plugin = Capacitor.isPluginAvailable("KotakNotificationTracker")
      ? registerPlugin<InboxPlugin>("KotakNotificationTracker")
      : undefined;
    let disposed = false;
    const refresh = () => {
      if (disposed) return;
      pendingCount.invalidate();
      if (!document.hidden) void pendingCount.refresh();
    };
    const handle = plugin?.addListener("notificationReceived", refresh);
    void handle?.catch(() => {});
    window.addEventListener("finance-notifications-updated", refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    void pendingCount.refresh();
    detach = () => {
      disposed = true;
      window.removeEventListener("finance-notifications-updated", refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      void handle?.then((value) => value.remove()).catch(() => {});
    };
  }
  return () => {
    unsubscribe();
    if (--users === 0) {
      detach?.();
      detach = undefined;
    }
  };
}
export function usePendingFinanceCount() {
  return useSyncExternalStore(
    subscribe,
    pendingCount.snapshot,
    pendingCount.serverSnapshot,
  ).value;
}
