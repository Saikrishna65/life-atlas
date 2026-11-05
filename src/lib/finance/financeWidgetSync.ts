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

export function syncFinanceWidget(data: FinanceWidgetData): void {
  if (typeof window === "undefined") return;
  try {
    if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("KotakNotificationTracker")) {
      const plugin = registerPlugin<KotakTrackerWithWidget>("KotakNotificationTracker");
      void plugin.updateFinanceWidget(data).catch(() => {});
    }
  } catch {
    // Non-native fallback
  }
}

