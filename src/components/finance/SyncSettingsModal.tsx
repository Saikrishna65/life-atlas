"use client";
import { FinancePanelHeader, useFinanceDialog } from "./FinanceDialog";

import React, { useState, useEffect, useCallback } from "react";
import {
  X,
  Cloud,
  CloudOff,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Lock,
  Database,
  ArrowUpRight,
  Trash2,
  Info,
} from "lucide-react";
import {
  SyncOperation,
  SyncOutboxService,
  IUnitOfWork,
} from "@/lib/finance";

interface SyncSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  uow: IUnitOfWork;
  syncOutboxService: SyncOutboxService;
}

export default function SyncSettingsModal({
  isOpen,
  onClose,
  uow,
  syncOutboxService,
}: SyncSettingsModalProps) {
  const [operations, setOperations] = useState<SyncOperation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{ type: "info" | "success" | "error"; text: string } | null>(null);

  const loadOperations = useCallback(async () => {
    setIsLoading(true);
    try {
      const all = await uow.outbox.getAll();
      // Sort newest first
      all.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
      setOperations(all);
    } catch (err) {
      console.error("Failed to load sync outbox:", err);
    } finally {
      setIsLoading(false);
    }
  }, [uow]);

  useEffect(() => {
    if (isOpen) {
      loadOperations();
      setSyncFeedback(null);
    }
  }, [isOpen, loadOperations]);

  const handleManualSync = async () => {
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      const result = await syncOutboxService.pushPending();
      if (result.pushedCount > 0) {
        setSyncFeedback({
          type: "success",
          text: `Successfully synced ${result.pushedCount} operations.`,
        });
      } else if (result.failedCount > 0) {
        setSyncFeedback({
          type: "error",
          text: `Sync attempted: ${result.failedCount} operations failed. Cloud endpoint returned unconfigured status.`,
        });
      } else {
        setSyncFeedback({
          type: "info",
          text: "No pending operations in outbox. Ledger is completely up to date locally.",
        });
      }
      await loadOperations();
    } catch (err: unknown) {
      setSyncFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Sync failed",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRetryFailed = async () => {
    try {
      const count = await syncOutboxService.retryFailedOperations();
      setSyncFeedback({
        type: "info",
        text: `Reset ${count} failed operations to pending status.`,
      });
      await loadOperations();
    } catch (err: unknown) {
      setSyncFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to reset operations",
      });
    }
  };

  const handlePurgeCompleted = async () => {
    try {
      const purged = await syncOutboxService.purgeCompleted(0);
      setSyncFeedback({
        type: "info",
        text: `Purged ${purged} synced records from local outbox history.`,
      });
      await loadOperations();
    } catch (err: unknown) {
      setSyncFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to purge completed outbox items",
      });
    }
  };

  useFinanceDialog(isOpen, onClose);
  if (!isOpen) return null;

  const pendingCount = operations.filter((o) => o.status === "pending" || o.status === "in_progress").length;
  const failedCount = operations.filter((o) => o.status === "failed_retryable" || o.status === "failed_permanent" || o.status === "failed").length;
  const syncedCount = operations.filter((o) => o.status === "synced").length;

  return (
    <div className="finance-workspace-overlay">
      <div className="finance-workspace finance-tool-workspace" role="dialog" aria-modal="true" aria-label="Storage & sync" tabIndex={-1}>
        <FinancePanelHeader title="Storage & sync" subtitle="See what is saved on this device and the status of your changes." onClose={onClose}/>

        {/* Content Body */}
        <div className="finance-panel-content overflow-y-auto space-y-4 py-4 pr-1 text-xs">
          {/* Status Banner */}
          <div className="p-3.5 rounded-xl bg-background/80 border border-muted space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-semibold text-foreground text-xs">
                  Active Mode: Local Vault (Offline First)
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Adapter: Unconfigured (Local-Only)
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Your financial ledger operates completely offline. Every account balance, transaction, transfer, budget,
              and savings goal is safely recorded in your device&apos;s encrypted local storage engine. No sensitive records
              are transmitted without explicit cloud endpoint configuration.
            </p>
          </div>

          {/* Feedback Notice */}
          {syncFeedback && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                syncFeedback.type === "success"
                  ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                  : syncFeedback.type === "error"
                  ? "bg-rose-500/10 border border-rose-500/30 text-rose-400"
                  : "bg-blue-500/10 border border-blue-500/30 text-blue-400"
              }`}
            >
              <Info className="w-4 h-4 shrink-0" />
              <span>{syncFeedback.text}</span>
            </div>
          )}

          {/* Outbox Metrics Summary */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="p-3 rounded-xl bg-background/60 border border-muted text-center">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground">Pending / Queued</span>
              <div className="text-lg font-mono font-bold text-amber-400 mt-1">{pendingCount}</div>
            </div>
            <div className="p-3 rounded-xl bg-background/60 border border-muted text-center">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground">Failed</span>
              <div className="text-lg font-mono font-bold text-rose-400 mt-1">{failedCount}</div>
            </div>
            <div className="p-3 rounded-xl bg-background/60 border border-muted text-center">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground">Synced</span>
              <div className="text-lg font-mono font-bold text-emerald-400 mt-1">{syncedCount}</div>
            </div>
          </div>

          {/* Outbox Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-500 text-white font-medium text-xs hover:bg-blue-400 transition-all disabled:opacity-50 cursor-pointer shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
              <span>{isSyncing ? "Testing Sync..." : "Attempt Cloud Sync"}</span>
            </button>

            <div className="flex items-center gap-2">
              {failedCount > 0 && (
                <button
                  onClick={handleRetryFailed}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 text-xs transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Retry Failed ({failedCount})</span>
                </button>
              )}

              {syncedCount > 0 && (
                <button
                  onClick={handlePurgeCompleted}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-muted text-muted-foreground hover:text-rose-400 hover:border-rose-500/30 text-xs transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Purge Synced</span>
                </button>
              )}
            </div>
          </div>

          {/* Outbox Operations List */}
          <div className="space-y-2 pt-2 border-t border-muted">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Recent Outbox Operations ({operations.length})
            </span>

            {operations.length === 0 ? (
              <div className="p-5 text-center text-muted-foreground border border-muted rounded-xl bg-background/40">
                Outbox is clean. No local mutations are currently waiting for synchronization.
              </div>
            ) : (
              <div className="max-h-56 overflow-y-auto space-y-1.5 border border-muted rounded-xl p-2 bg-background/40">
                {operations.slice(0, 30).map((op) => (
                  <div
                    key={op.id}
                    className="p-2 rounded-lg bg-surface/60 border border-muted/50 flex items-center justify-between text-[11px]"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-foreground uppercase text-[10px]">
                          {op.action} {op.entityType}
                        </span>
                        <span className="font-mono text-[9px] text-muted-foreground">
                          {op.entityId.slice(0, 8)}...
                        </span>
                      </div>
                      <div className="text-[9px] text-muted-foreground font-mono">
                        Queued: {new Date(op.timestamp).toLocaleTimeString("en-IN")} | Retries: {op.retryCount}
                        {op.lastError && (
                          <span className="text-rose-400 ml-1.5 truncate max-w-[200px] inline-block align-bottom">
                            ({op.lastError})
                          </span>
                        )}
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase ${
                        op.status === "synced"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : op.status === "pending" || op.status === "in_progress"
                          ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                      }`}
                    >
                      {op.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cryptographic & Storage Security Disclosure */}
          <div className="p-3.5 rounded-xl bg-surface border border-muted/70 space-y-2">
            <div className="flex items-center gap-1.5 font-semibold text-foreground text-xs">
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Offline Architecture & Storage Guarantees</span>
            </div>
            <ul className="text-[10px] text-muted-foreground space-y-1 list-disc list-inside leading-relaxed">
              <li>
                <strong className="text-foreground">Zero Cloud Dependency:</strong> Calculations, projections, runway
                estimates, and categorization work 100% locally without network roundtrips.
              </li>
              <li>
                <strong className="text-foreground">Idempotent Mutations:</strong> Every outbox operation is signed with
                a deterministic idempotency key and monotonic version number to prevent duplicate charges or double counts.
              </li>
              <li>
                <strong className="text-foreground">Transfer Invariant Protection:</strong> Balanced transfers are linked
                by transfer group ID, guaranteeing double-entry consistency across all sync operations.
              </li>
            </ul>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="finance-panel-footer pt-3 border-t border-muted flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-surface border border-muted hover:border-foreground/30 text-xs font-medium text-foreground transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
