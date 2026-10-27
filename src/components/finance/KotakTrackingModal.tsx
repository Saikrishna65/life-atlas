"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  X,
  Bell,
  BellRing,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  RefreshCw,
  ExternalLink,
  Smartphone,
  Trash2,
  Check,
  Ban,
  ArrowDownRight,
  ArrowUpRight,
  HelpCircle,
  Sparkles,
} from "lucide-react";
import {
  NotificationTrackingService,
  NotificationTrackingStatus,
  NotificationReviewItem,
  FinanceAccount,
  FinanceCategory,
  RawNotificationEvent,
  formatPaise,
} from "@/lib/finance";

interface KotakTrackingModalProps {
  isOpen: boolean;
  onClose: () => void;
  trackingService: NotificationTrackingService;
  accounts: FinanceAccount[];
  categories: FinanceCategory[];
  onTransactionsUpdated: () => void;
}

export default function KotakTrackingModal({
  isOpen,
  onClose,
  trackingService,
  accounts,
  categories,
  onTransactionsUpdated,
}: KotakTrackingModalProps) {
  const [status, setStatus] = useState<NotificationTrackingStatus | null>(null);
  const [reviewItems, setReviewItems] = useState<NotificationReviewItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDraining, setIsDraining] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [selectedAccounts, setSelectedAccounts] = useState<Record<string, string>>({});
  const [selectedCategories, setSelectedCategories] = useState<Record<string, string>>({});
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [showOsGuide, setShowOsGuide] = useState(false);
  const [showPermissionDisclosure, setShowPermissionDisclosure] = useState(false);

  // Load Status and Review Items
  const loadStatus = useCallback(async () => {
    try {
      const s = await trackingService.getStatus();
      setStatus(s);
      setReviewItems(trackingService.getReviewQueue());
    } catch (e) {
      console.error("Failed to load tracking status:", e);
    }
  }, [trackingService]);

  useEffect(() => {
    if (isOpen) {
      loadStatus();
      const interval = setInterval(loadStatus, 4000);
      return () => clearInterval(interval);
    }
  }, [isOpen, loadStatus]);

  if (!isOpen) return null;

  // Toggle Tracking
  const handleToggleTracking = async () => {
    if (!status) return;
    setIsLoading(true);
    try {
      const next = !status.enabled;
      await trackingService.setTrackingEnabled(next);
      await loadStatus();
      setFeedbackMessage(next ? "Notification tracking enabled." : "Notification tracking disabled.");
    } catch (e) {
      console.error(e);
      setFeedbackMessage("Failed to update tracking state.");
    } finally {
      setIsLoading(false);
    }
  };

  // Request Android Notification Access with upfront disclosure
  const handleRequestPermission = () => {
    setShowPermissionDisclosure(true);
  };

  const handleConfirmOpenSettings = async () => {
    setShowPermissionDisclosure(false);
    try {
      await trackingService.requestNotificationAccess();
      setFeedbackMessage("Opening Android Notification Listener settings...");
    } catch (e) {
      console.error(e);
      setFeedbackMessage("Could not open system settings.");
    }
  };

  // Drain Queue
  const handleDrainQueue = async () => {
    setIsDraining(true);
    try {
      const res = await trackingService.drainPendingNotifications();
      await loadStatus();
      onTransactionsUpdated();
      setFeedbackMessage(
        `Processed ${res.processed} transaction(s), ${res.duplicates} duplicate(s) ignored.`
      );
    } catch (e) {
      console.error(e);
      setFeedbackMessage("Failed to drain notifications.");
    } finally {
      setIsDraining(false);
    }
  };

  // Simulate Test Notification
  const handleSimulateNotification = async (type: "swiggy" | "zepto" | "salary") => {
    setIsSimulating(true);
    try {
      let raw: RawNotificationEvent;
      const now = Date.now();
      const iso = new Date().toISOString();

      if (type === "swiggy") {
        raw = {
          id: `sim_swiggy_${now}`,
          packageName: "com.msf.kbank.mobile",
          sender: "Kotak Bank",
          title: "Sent Rs. 380.00",
          text: `Sent Rs. 380.00 from Kotak Bank AC X1234 to SWIGGY on ${new Date().toLocaleDateString("en-GB")}. UPI Ref ${Math.floor(100000000000 + Math.random() * 900000000000)}.`,
          postTime: now,
          postTimeIso: iso,
        };
      } else if (type === "zepto") {
        raw = {
          id: `sim_zepto_${now}`,
          packageName: "com.msf.kbank.mobile",
          sender: "Kotak Bank",
          title: "Debited Rs. 620.00",
          text: `Debited Rs. 620.00 from Kotak Bank A/c ...XX1234 to ZEPTO via UPI. Ref: ${Math.floor(100000000000 + Math.random() * 900000000000)}. Avl Bal: Rs 18,500.00`,
          postTime: now,
          postTimeIso: iso,
        };
      } else {
        raw = {
          id: `sim_salary_${now}`,
          packageName: "com.msf.kbank.mobile",
          sender: "Kotak Bank",
          title: "Received Rs. 45,000.00",
          text: `Received Rs. 45,000.00 in your Kotak Bank A/c ...1234 from ACME PVT LTD towards SALARY. Ref ${Math.floor(100000000000 + Math.random() * 900000000000)}.`,
          postTime: now,
          postTimeIso: iso,
        };
      }

      const res = await trackingService.processRawEvents([raw]);
      await loadStatus();
      onTransactionsUpdated();
      setFeedbackMessage(
        res.processed > 0
          ? `Simulated transaction recorded in ledger!`
          : `Simulated event processed (${res.duplicates} duplicates, or routed to review).`
      );
    } catch (e) {
      console.error(e);
      setFeedbackMessage("Simulation failed.");
    } finally {
      setIsSimulating(false);
    }
  };

  // Resolve Review Item
  const handleResolveReviewItem = async (itemId: string) => {
    const accountId = selectedAccounts[itemId] || accounts[0]?.id;
    if (!accountId) {
      setFeedbackMessage("Please select an account for this transaction.");
      return;
    }
    const categoryId = selectedCategories[itemId];

    try {
      await trackingService.resolveReviewItem(itemId, accountId, categoryId);
      await loadStatus();
      onTransactionsUpdated();
      setFeedbackMessage("Transaction assigned and recorded in ledger.");
    } catch (e) {
      console.error(e);
      setFeedbackMessage("Failed to record reviewed transaction.");
    }
  };

  // Dismiss Review Item
  const handleDismissReviewItem = (itemId: string) => {
    trackingService.dismissReviewItem(itemId);
    setReviewItems(trackingService.getReviewQueue());
    setFeedbackMessage("Item dismissed without recording.");
  };

  // Clear Tracking Data
  const handleClearData = async () => {
    if (confirm("Reset tracking counters and clear pending review items?")) {
      await trackingService.clearTrackingData();
      await loadStatus();
      setFeedbackMessage("Tracking counters reset.");
    }
  };

  const isAccessGranted = status?.permissionGranted;
  const isEnabled = status?.enabled;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center">
              <BellRing className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-foreground">Kotak 811 Auto-Tracking</h2>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    isEnabled && isAccessGranted
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : isEnabled && !isAccessGranted
                      ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      : "bg-muted text-muted-foreground border-transparent"
                  }`}
                >
                  {isEnabled && isAccessGranted
                    ? "ACTIVE"
                    : isEnabled && !isAccessGranted
                    ? "PERMISSION NEEDED"
                    : "DISABLED"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Automatic Kotak 811 mobile app transaction tracking with zero cloud sync
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Message */}
        {feedbackMessage && (
          <div className="px-6 py-2 bg-blue-500/10 border-b border-blue-500/20 text-blue-400 text-xs flex items-center justify-between">
            <span>{feedbackMessage}</span>
            <button
              onClick={() => setFeedbackMessage(null)}
              className="text-xs hover:underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          {/* 1. Main Toggle Card */}
          <div className="p-4 bg-surface border border-border rounded-xl flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="font-semibold text-sm text-foreground">
                Automatic Notification Tracking
              </div>
              <p className="text-muted-foreground leading-relaxed text-[11px]">
                Listen to genuine Kotak transaction notifications, extract amounts & merchants, and record
                them instantly into your Life Atlas ledger.
              </p>
            </div>
            <button
              onClick={handleToggleTracking}
              disabled={isLoading}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                isEnabled ? "bg-emerald-500" : "bg-muted"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  isEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* 2. Permission Banner */}
          {status?.isNativeAndroid ? (
            <div
              className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                isAccessGranted
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-400"
              }`}
            >
              <div className="flex items-start gap-3">
                {isAccessGranted ? (
                  <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-400" />
                )}
                <div>
                  <div className="font-semibold text-foreground">
                    Android Notification Access: {isAccessGranted ? "Granted" : "Required"}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {isAccessGranted
                      ? "Life Atlas has native Android notification listener permission enabled."
                      : "Grant notification listener access to allow Life Atlas to detect incoming Kotak transactions."}
                  </p>
                </div>
              </div>

              {!isAccessGranted && (
                <button
                  onClick={handleRequestPermission}
                  className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs transition-all shrink-0 cursor-pointer shadow-xs active:scale-95"
                >
                  Open Android Settings
                </button>
              )}
            </div>
          ) : (
            <div className="p-3.5 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center gap-3 text-blue-400">
              <Smartphone className="w-4 h-4 shrink-0" />
              <div className="text-[11px] text-muted-foreground">
                <span className="font-semibold text-foreground">Web Testing Mode:</span> Native
                NotificationListener runs on the Android app build. You can test parsing, deduplication, and
                ledger updates below using real synthetic bank events.
              </div>
            </div>
          )}

          {/* 3. Live Statistics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-surface border border-border rounded-xl space-y-1">
              <span className="text-[10px] uppercase font-mono text-muted-foreground">Events Received</span>
              <div className="text-xl font-bold text-foreground font-mono">
                {status?.eventsReceivedCount ?? 0}
              </div>
              <span className="text-[10px] text-muted-foreground block truncate">Kotak app alerts</span>
            </div>

            <div className="p-3 bg-surface border border-border rounded-xl space-y-1">
              <span className="text-[10px] uppercase font-mono text-muted-foreground">Duplicates Ignored</span>
              <div className="text-xl font-bold text-emerald-400 font-mono">
                {status?.duplicatesIgnoredCount ?? 0}
              </div>
              <span className="text-[10px] text-muted-foreground block truncate">Triple-source filtered</span>
            </div>

            <div className="p-3 bg-surface border border-border rounded-xl space-y-1">
              <span className="text-[10px] uppercase font-mono text-muted-foreground">Queue Pending</span>
              <div className="text-xl font-bold text-foreground font-mono">
                {status?.pendingCount ?? 0}
              </div>
              <span className="text-[10px] text-muted-foreground block truncate">Stored on disk</span>
            </div>

            <div className="p-3 bg-surface border border-border rounded-xl space-y-1">
              <span className="text-[10px] uppercase font-mono text-muted-foreground">Needs Review</span>
              <div className="text-xl font-bold text-amber-400 font-mono">
                {reviewItems.length}
              </div>
              <span className="text-[10px] text-muted-foreground block truncate">Unassigned account</span>
            </div>
          </div>

          {/* Diagnostic Times & Actions Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-surface border border-border rounded-xl text-[11px]">
            <div className="space-y-0.5 text-muted-foreground">
              <div>
                Last Event:{" "}
                <span className="text-foreground font-mono">
                  {status?.lastEventTime
                    ? new Date(status.lastEventTime).toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })
                    : "None"}
                </span>
              </div>
              <div>
                Last Transaction:{" "}
                <span className="text-foreground font-mono">
                  {status?.lastTransactionTime
                    ? new Date(status.lastTransactionTime).toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })
                    : "None"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleDrainQueue}
                disabled={isDraining}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground transition-all cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isDraining ? "animate-spin" : ""}`} />
                <span>Drain Queue</span>
              </button>

              <button
                onClick={handleClearData}
                className="p-1.5 text-muted-foreground hover:text-rose-400 rounded-lg hover:bg-muted cursor-pointer"
                title="Reset counters"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 4. Review Queue (If items exist) */}
          {reviewItems.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">Pending Review Queue</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-black font-bold">
                    {reviewItems.length}
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground">Assign accounts or dismiss</span>
              </div>

              <div className="space-y-2.5">
                {reviewItems.map((item) => {
                  const txn = item.parsedTransaction;
                  const isOutflow = txn.direction === "outflow";
                  return (
                    <div
                      key={item.id}
                      className="p-3.5 bg-surface border border-amber-500/30 rounded-xl space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                              isOutflow ? "bg-rose-500/10 text-rose-400" : "bg-emerald-500/10 text-emerald-400"
                            }`}
                          >
                            {isOutflow ? (
                              <ArrowDownRight className="w-4 h-4" />
                            ) : (
                              <ArrowUpRight className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-foreground text-xs">{txn.merchantOrBeneficiary}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {txn.sourceType.toUpperCase()} • {new Date(txn.occurredAt).toLocaleString()}
                              {txn.referenceNumber ? ` • Ref: ${txn.referenceNumber}` : ""}
                            </div>
                            <div className="text-[10px] text-amber-400 mt-0.5">{item.reason}</div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div
                            className={`font-mono font-bold text-sm ${
                              isOutflow ? "text-rose-400" : "text-emerald-400"
                            }`}
                          >
                            {isOutflow ? "-" : "+"}
                            {formatPaise(txn.amountPaise)}
                          </div>
                          {txn.accountMask && (
                            <span className="text-[10px] text-muted-foreground font-mono">
                              Kotak *{txn.accountMask}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Assignment Row */}
                      <div className="pt-2 border-t border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1">
                          <select
                            value={selectedAccounts[item.id] || ""}
                            onChange={(e) =>
                              setSelectedAccounts((prev) => ({ ...prev, [item.id]: e.target.value }))
                            }
                            className="bg-card border border-border rounded-lg px-2 py-1 text-[11px] text-foreground flex-1 focus:outline-none"
                          >
                            <option value="">Select Account...</option>
                            {accounts.map((acc) => (
                              <option key={acc.id} value={acc.id}>
                                {acc.name} ({acc.accountType})
                              </option>
                            ))}
                          </select>

                          <select
                            value={selectedCategories[item.id] || ""}
                            onChange={(e) =>
                              setSelectedCategories((prev) => ({ ...prev, [item.id]: e.target.value }))
                            }
                            className="bg-card border border-border rounded-lg px-2 py-1 text-[11px] text-foreground flex-1 focus:outline-none"
                          >
                            <option value="">Optional Category...</option>
                            {categories
                              .filter((c) => (isOutflow ? c.type === "expense" : c.type === "income"))
                              .map((cat) => (
                                <option key={cat.id} value={cat.id}>
                                  {cat.name}
                                </option>
                              ))}
                          </select>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => handleResolveReviewItem(item.id)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-[11px] transition-all cursor-pointer flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Approve</span>
                          </button>
                          <button
                            onClick={() => handleDismissReviewItem(item.id)}
                            className="px-2.5 py-1 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground text-[11px] transition-all cursor-pointer flex items-center gap-1"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            <span>Dismiss</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 5. Notification Simulator (Quick Test) */}
          <div className="p-4 bg-surface border border-border rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span className="font-semibold text-foreground">Test & Simulator</span>
              </div>
              <span className="text-[10px] text-muted-foreground">Simulate real Kotak notifications</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleSimulateNotification("swiggy")}
                disabled={isSimulating}
                className="px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground transition-all cursor-pointer font-medium text-[11px]"
              >
                + Swiggy ₹380 Outflow (App)
              </button>
              <button
                onClick={() => handleSimulateNotification("zepto")}
                disabled={isSimulating}
                className="px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground transition-all cursor-pointer font-medium text-[11px]"
              >
                + Zepto ₹620 Outflow (App)
              </button>
              <button
                onClick={() => handleSimulateNotification("salary")}
                disabled={isSimulating}
                className="px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground transition-all cursor-pointer font-medium text-[11px]"
              >
                + Salary ₹45,000 Inflow
              </button>
            </div>
          </div>

          {/* 6. OS Battery & Background Setup Guide (Collapsible) */}
          <div className="border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => setShowOsGuide((prev) => !prev)}
              className="w-full px-4 py-3 bg-surface hover:bg-muted/50 flex items-center justify-between text-left transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-muted-foreground" />
                <span className="font-semibold text-foreground">
                  OEM Android Background Settings (Xiaomi, Samsung, OnePlus)
                </span>
              </div>
              <span className="text-[11px] text-muted-foreground font-mono">
                {showOsGuide ? "▲ Hide" : "▼ View"}
              </span>
            </button>

            {showOsGuide && (
              <div className="p-4 bg-card/60 space-y-3 text-[11px] text-muted-foreground leading-relaxed border-t border-border">
                <p>
                  Android OEM battery managers may kill background notification listeners when the screen is
                  off. To guarantee 24/7 real-time tracking:
                </p>
                <div className="space-y-2">
                  <div className="p-2.5 bg-surface rounded-lg border border-border/50">
                    <span className="font-bold text-foreground block">Xiaomi / Redmi (MIUI / HyperOS):</span>
                    Go to Settings → Apps → Manage Apps → Life Atlas → Turn on <strong>Autostart</strong>.
                    Set Battery Saver to <strong>No restrictions</strong>.
                  </div>
                  <div className="p-2.5 bg-surface rounded-lg border border-border/50">
                    <span className="font-bold text-foreground block">Samsung (One UI):</span>
                    Go to Settings → Apps → Life Atlas → Battery → Select <strong>Unrestricted</strong>. Add Life
                    Atlas to <strong>Never sleeping apps</strong>.
                  </div>
                  <div className="p-2.5 bg-surface rounded-lg border border-border/50">
                    <span className="font-bold text-foreground block">OnePlus / Oppo / Vivo:</span>
                    Open Recent Apps screen → tap the three dots on Life Atlas → select <strong>Lock</strong> so
                    the OS doesn't purge it during RAM cleanups.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 7. Privacy & Security Assurance */}
          <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl space-y-2 text-foreground">
            <div className="flex items-center gap-2 font-bold text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
              <span>100% On-Device Local Privacy Guarantee</span>
            </div>
            <p className="leading-relaxed text-muted-foreground text-[11px]">
              Kotak transaction notifications are processed <strong>exclusively inside your phone</strong>.
              OTPs, login security notices, passwords, promotional loan banners, and balance inquiries are
              strictly rejected. Deduplication ensures repeated alerts will <strong>never produce duplicate ledger entries</strong>.
              Zero notification text is transmitted over the internet.
            </p>
          </div>

          {/* 8. Explicit Feature Limitations Disclosure */}
          <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl space-y-2 text-foreground">
            <div className="flex items-center gap-2 font-bold text-amber-400">
              <AlertTriangle className="w-4 h-4" />
              <span>Feature Limitations & Scope</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground text-[11px] leading-relaxed">
              <li>
                <strong>Official Kotak Apps Only:</strong> Listens strictly for transaction notifications posted by official Kotak mobile banking apps (<code className="text-amber-300 font-mono text-[10px]">com.msf.kbank.mobile</code>, <code className="text-amber-300 font-mono text-[10px]">com.kotak.mbanking</code>).
              </li>
              <li>
                <strong>No SMS Inbox Access:</strong> Life Atlas does <em>not</em> request or use <code className="text-foreground font-mono text-[10px]">READ_SMS</code> or <code className="text-foreground font-mono text-[10px]">RECEIVE_SMS</code> permissions and cannot read your SMS inbox or historical text messages.
              </li>
              <li>
                <strong>No Historical Sync:</strong> Only new notifications arriving while Notification Access is granted will be captured.
              </li>
              <li>
                <strong>System Dependent:</strong> If OEM battery managers (e.g. MIUI/HyperOS, Samsung One UI) terminate background listeners or notifications are silenced, transactions cannot be detected.
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-3 border-t border-border bg-card/50">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs transition-all cursor-pointer"
          >
            Close
          </button>
        </div>

        {/* Upfront Permission Disclosure Dialog (Requirement 5) */}
        {showPermissionDisclosure && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="relative w-full max-w-lg bg-card border border-amber-500/40 rounded-2xl shadow-2xl p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Android Notification Access Disclosure
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Please review how Life Atlas uses Notification Access before proceeding to Android Settings.
                  </p>
                </div>
              </div>

              <div className="p-3.5 bg-surface border border-border/80 rounded-xl space-y-2 text-[11px] text-muted-foreground leading-relaxed">
                <div>
                  <strong className="text-foreground block">Why does Life Atlas need this?</strong>
                  To automatically detect incoming debit and credit transaction notifications from official Kotak mobile banking apps and record them into your local finance ledger.
                </div>
                <div>
                  <strong className="text-foreground block">What Life Atlas does NOT do:</strong>
                  <ul className="list-disc list-inside mt-1 space-y-0.5">
                    <li>Does <strong>not</strong> read your SMS inbox or text messages (<code className="text-foreground font-mono text-[10px]">READ_SMS</code> is never requested).</li>
                    <li>Does <strong>not</strong> monitor personal chats, WhatsApp, social media, or other apps.</li>
                    <li>Does <strong>not</strong> upload, send, or transmit notification text to any external server or cloud.</li>
                  </ul>
                </div>
                <div>
                  <strong className="text-foreground block">Limitations:</strong>
                  Only new notifications from official Kotak apps received while the feature is enabled will be detected. Past transactions and suppressed notifications cannot be tracked.
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  onClick={() => setShowPermissionDisclosure(false)}
                  className="px-4 py-2 rounded-xl border border-border hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-semibold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmOpenSettings}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95"
                >
                  I Understand — Open Android Settings
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

