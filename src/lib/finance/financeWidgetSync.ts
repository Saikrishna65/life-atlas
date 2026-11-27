import { FinanceRefreshQueue } from "./application/refreshQueue";
import { Capacitor, registerPlugin } from "@capacitor/core";

export interface FinanceWidgetData {
  balance: string;
  account?: string;
  subtext?: string;
  pendingCount?: number;
}

interface KotakTrackerWithWidget {
  updateFinanceWidget(options: FinanceWidgetData): Promise<{ success: boolean }>;
}

const widgetQueue = new FinanceRefreshQueue();
let pendingKey: string | null = null, writtenKey: string | null = null;
export function syncFinanceWidget(data: FinanceWidgetData): void {
  if (typeof window === "undefined") return;
  try {
    if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable("KotakNotificationTracker")) return;
    const key = JSON.stringify(data); if (key === pendingKey) return;
    pendingKey = key;
    void widgetQueue.request(async () => {
      try { if (key !== writtenKey) { const plugin = registerPlugin<KotakTrackerWithWidget>("KotakNotificationTracker"); await plugin.updateFinanceWidget(data); writtenKey = key; } }
      catch { /* A failed widget write must not discard the latest queued update. */ }
      finally { if (pendingKey === key) pendingKey = null; }
    }).catch(() => {});
  } catch { /* Non-native fallback; widget failure must never block Finance. */ }
}
