"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  X,
  Sparkles,
  Clipboard,
  CheckCircle2,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  ShieldCheck,
  FileUp,
  Check,
  Ban,
  Info,
} from "lucide-react";
import {
  NotificationTrackingService,
  FinanceAccount,
  FinanceCategory,
  NotificationReviewItem,
  formatPaise,
  ParseAlertResult,
} from "@/lib/finance";

interface KotakTrackingModalProps {
  isOpen: boolean;
  onClose: () => void;
  trackingService: NotificationTrackingService;
  accounts: FinanceAccount[];
  categories: FinanceCategory[];
  onTransactionsUpdated: () => void;
  onOpenStatementImport?: () => void;
}

type ModalTab = "PASTE" | "IMPORT" | "PRIVACY" | "REVIEW";

export default function KotakTrackingModal({
  isOpen,
  onClose,
  trackingService,
  accounts,
  categories,
  onTransactionsUpdated,
  onOpenStatementImport,
}: KotakTrackingModalProps) {
  const [activeTab, setActiveTab] = useState<ModalTab>("PASTE");
  const [alertText, setAlertText] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [parseResult, setParseResult] = useState<ParseAlertResult | null>(null);

  // Editable fields for parsed transaction preview
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [editableMerchant, setEditableMerchant] = useState("");

  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  // Legacy or staged review items
  const [reviewItems, setReviewItems] = useState<NotificationReviewItem[]>([]);
  const [reviewAccounts, setReviewAccounts] = useState<Record<string, string>>({});
  const [reviewCategories, setReviewCategories] = useState<Record<string, string>>({});

  const loadReviewQueue = useCallback(() => {
    try {
      setReviewItems(trackingService.getReviewQueue());
    } catch (e) {
      console.warn("Failed to load review queue:", e);
    }
  }, [trackingService]);

  useEffect(() => {
    if (isOpen) {
      loadReviewQueue();
    }
  }, [isOpen, loadReviewQueue]);

  if (!isOpen) return null;

  // Handle parsing the pasted text
  const handleParse = async (textToParse?: string) => {
    const raw = (textToParse ?? alertText).trim();
    if (!raw) {
      setFeedbackMessage({
        type: "error",
        text: "Please enter or paste a Kotak transaction notification or SMS.",
      });
      return;
    }

    setIsParsing(true);
    setFeedbackMessage(null);

    try {
      const res = await trackingService.parseAlertText(raw);
      setParseResult(res);

      if (res.success && res.parsed) {
        setEditableMerchant(res.parsed.merchantOrBeneficiary);
        // Pre-select matched account, or first bank account, or empty
        if (res.matchedAccount) {
          setSelectedAccountId(res.matchedAccount.id);
        } else {
          const firstBank = accounts.find((a) => a.accountType === "bank" || a.accountType === "savings");
          setSelectedAccountId(firstBank ? firstBank.id : accounts[0]?.id || "");
        }

        // Pre-select suggested category if available
        if (res.suggestedCategory) {
          setSelectedCategoryId(res.suggestedCategory.categoryId);
        } else {
          setSelectedCategoryId("");
        }

        if (res.isDuplicate) {
          setFeedbackMessage({
            type: "info",
            text: res.duplicateReason || "Duplicate detected: already present in ledger.",
          });
        }
      } else {
        setFeedbackMessage({
          type: "error",
          text: res.error || "Unable to parse this message as a Kotak transaction.",
        });
      }
    } catch (err: unknown) {
      console.error("Parsing failed:", err);
      setFeedbackMessage({
        type: "error",
        text: "Failed to parse text. Please check the format.",
      });
    } finally {
      setIsParsing(false);
    }
  };

  // Clipboard paste action
  const handlePasteFromClipboard = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.readText) {
        const clipText = await navigator.clipboard.readText();
        if (clipText && clipText.trim()) {
          setAlertText(clipText);
          await handleParse(clipText);
          return;
        }
      }
      setFeedbackMessage({
        type: "info",
        text: "Clipboard is empty or access was not granted. Please paste text directly into the box.",
      });
    } catch (err) {
      console.warn("Clipboard access error:", err);
      setFeedbackMessage({
        type: "info",
        text: "Could not read clipboard automatically. Please press and hold inside the box to paste.",
      });
    }
  };

  // Clear current input and preview
  const handleClear = () => {
    setAlertText("");
    setParseResult(null);
    setEditableMerchant("");
    setSelectedAccountId("");
    setSelectedCategoryId("");
    setFeedbackMessage(null);
  };

  // Record parsed transaction into official ledger
  const handleConfirmRecord = async () => {
    if (!parseResult?.success || !parseResult.parsed) return;

    if (!selectedAccountId) {
      setFeedbackMessage({
        type: "error",
        text: "Please select an account before recording this transaction.",
      });
      return;
    }

    setIsRecording(true);
    try {
      await trackingService.confirmParsedTransaction({
        parsed: parseResult.parsed,
        accountId: selectedAccountId,
        categoryId: selectedCategoryId || undefined,
        description: editableMerchant || parseResult.parsed.merchantOrBeneficiary,
      });

      onTransactionsUpdated();
      setFeedbackMessage({
        type: "success",
        text: `Transaction recorded into ledger: ${formatPaise(parseResult.parsed.amountPaise)} (${editableMerchant || parseResult.parsed.merchantOrBeneficiary})`,
      });

      // Reset form
      handleClear();
    } catch (err: unknown) {
      console.error("Recording error:", err);
      setFeedbackMessage({
        type: "error",
        text: "Failed to commit transaction to ledger. Please check account balance or constraints.",
      });
    } finally {
      setIsRecording(false);
    }
  };

  // Quick Synthetic samples for convenience
  const handleLoadSample = (type: "swiggy" | "salary" | "zepto") => {
    const today = new Date().toLocaleDateString("en-GB");
    const fakeRef = Math.floor(100000000000 + Math.random() * 900000000000);
    let sample = "";

    if (type === "swiggy") {
      sample = `Sent Rs. 380.00 from Kotak Bank AC X1234 to SWIGGY on ${today}. UPI Ref ${fakeRef}. Avl bal Rs 9,620.00.`;
    } else if (type === "salary") {
      sample = `Received Rs. 45,000.00 in your Kotak Bank A/c ...1234 from ACME PVT LTD towards SALARY on ${today}. Ref ${fakeRef}.`;
    } else {
      sample = `Debited Rs. 620.00 from Kotak Bank A/c ...XX1234 to ZEPTO via UPI on ${today}. Ref: ${fakeRef}. Avl Bal: Rs 18,500.00.`;
    }

    setAlertText(sample);
    handleParse(sample);
  };

  // Review Queue Handlers
  const handleResolveReviewItem = async (itemId: string) => {
    const accountId = reviewAccounts[itemId] || accounts[0]?.id;
    if (!accountId) {
      setFeedbackMessage({
        type: "error",
        text: "Please select an account for this transaction.",
      });
      return;
    }
    const categoryId = reviewCategories[itemId];

    try {
      await trackingService.resolveReviewItem(itemId, accountId, categoryId);
      loadReviewQueue();
      onTransactionsUpdated();
      setFeedbackMessage({
        type: "success",
        text: "Transaction assigned and recorded in ledger.",
      });
    } catch (e) {
      console.error(e);
      setFeedbackMessage({
        type: "error",
        text: "Failed to record reviewed transaction.",
      });
    }
  };

  const handleDismissReviewItem = (itemId: string) => {
    trackingService.dismissReviewItem(itemId);
    loadReviewQueue();
    setFeedbackMessage({
      type: "info",
      text: "Item dismissed without recording in ledger.",
    });
  };

  const parsedTxn = parseResult?.success ? parseResult.parsed : null;
  const isOutflow = parsedTxn?.direction === "outflow";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl max-h-[92vh] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center shrink-0 border border-red-500/20">
              <Sparkles className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-foreground">Kotak 811 Smart Assistant</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  100% OFFLINE
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Instant on-device transaction parser, duplicate defense & statement ingestion
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-6 pt-3 pb-2 border-b border-border/70 bg-surface/40 text-xs overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab("PASTE")}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "PASTE"
                ? "bg-card text-foreground shadow-xs font-semibold border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Paste & Record
          </button>
          <button
            onClick={() => setActiveTab("IMPORT")}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "IMPORT"
                ? "bg-card text-foreground shadow-xs font-semibold border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Statement Import (CSV)
          </button>
          <button
            onClick={() => setActiveTab("PRIVACY")}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "PRIVACY"
                ? "bg-card text-foreground shadow-xs font-semibold border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Privacy & Architecture
          </button>
          {reviewItems.length > 0 && (
            <button
              onClick={() => setActiveTab("REVIEW")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === "REVIEW"
                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/30 font-semibold"
                  : "text-amber-400 hover:text-amber-300"
              }`}
            >
              <span>Review Queue</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-black font-bold">
                {reviewItems.length}
              </span>
            </button>
          )}
        </div>

        {/* Feedback Banner */}
        {feedbackMessage && (
          <div
            className={`px-6 py-2.5 text-xs flex items-center justify-between border-b ${
              feedbackMessage.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                : feedbackMessage.type === "error"
                ? "bg-rose-500/10 border-rose-500/20 text-rose-400"
                : "bg-blue-500/10 border-blue-500/20 text-blue-400"
            }`}
          >
            <div className="flex items-center gap-2">
              {feedbackMessage.type === "success" && <CheckCircle2 className="w-4 h-4 shrink-0" />}
              {feedbackMessage.type === "error" && <AlertTriangle className="w-4 h-4 shrink-0" />}
              {feedbackMessage.type === "info" && <Info className="w-4 h-4 shrink-0" />}
              <span>{feedbackMessage.text}</span>
            </div>
            <button
              onClick={() => setFeedbackMessage(null)}
              className="text-xs hover:underline cursor-pointer opacity-80 hover:opacity-100"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          {/* TAB 1: PASTE & RECORD */}
          {activeTab === "PASTE" && (
            <div className="space-y-4">
              {/* Text Input Box */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-foreground flex items-center gap-1.5">
                    <span>Transaction SMS or Notification Text</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handlePasteFromClipboard}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface border border-border hover:border-foreground/30 text-foreground transition-all cursor-pointer font-medium text-[11px]"
                    >
                      <Clipboard className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Paste Clipboard</span>
                    </button>
                    {alertText && (
                      <button
                        type="button"
                        onClick={handleClear}
                        className="text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                <textarea
                  rows={3}
                  value={alertText}
                  onChange={(e) => {
                    setAlertText(e.target.value);
                    if (parseResult) setParseResult(null);
                  }}
                  placeholder="Paste your Kotak Bank debit or credit notification text here...&#10;&#10;Example: Sent Rs. 380.00 from Kotak Bank AC X1234 to SWIGGY on 28/10/2026. UPI Ref 539201948123."
                  className="w-full p-3 rounded-xl bg-surface border border-border text-foreground font-mono text-xs focus:outline-none focus:border-red-500/50 transition-colors placeholder:text-muted-foreground/60 resize-none"
                />

                {/* Sample helpers */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] text-muted-foreground">Quick test samples:</span>
                  <button
                    type="button"
                    onClick={() => handleLoadSample("swiggy")}
                    className="px-2 py-0.5 rounded-md bg-muted/60 hover:bg-muted text-[10px] text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                  >
                    + Swiggy ₹380
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLoadSample("salary")}
                    className="px-2 py-0.5 rounded-md bg-muted/60 hover:bg-muted text-[10px] text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                  >
                    + Salary ₹45,000
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLoadSample("zepto")}
                    className="px-2 py-0.5 rounded-md bg-muted/60 hover:bg-muted text-[10px] text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                  >
                    + Zepto ₹620
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleParse()}
                  disabled={isParsing || !alertText.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-xs transition-all disabled:opacity-40 cursor-pointer shadow-xs active:scale-95"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isParsing ? "Parsing Alert..." : "Parse Transaction"}</span>
                </button>
              </div>

              {/* Parsed Result Preview Card */}
              {parsedTxn && (
                <div className="p-4 rounded-xl border border-border bg-surface/70 space-y-4 animate-in fade-in duration-200">
                  {/* Header preview row */}
                  <div className="flex items-start justify-between gap-3 border-b border-border/60 pb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                          isOutflow
                            ? "bg-rose-500/10 border-rose-500/20 text-rose-400"
                            : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                        }`}
                      >
                        {isOutflow ? (
                          <ArrowDownRight className="w-5 h-5" />
                        ) : (
                          <ArrowUpRight className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isOutflow
                                ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            }`}
                          >
                            {isOutflow ? "OUTFLOW (DEBIT)" : "INFLOW (CREDIT)"}
                          </span>
                          {parsedTxn.referenceNumber && (
                            <span className="font-mono text-[10px] text-muted-foreground">
                              Ref: {parsedTxn.referenceNumber}
                            </span>
                          )}
                        </div>
                        <div className="font-display text-2xl font-bold text-foreground mt-1">
                          {isOutflow ? "-" : "+"}
                          {formatPaise(parsedTxn.amountPaise)}
                        </div>
                      </div>
                    </div>

                    <div className="text-right text-[10px] text-muted-foreground font-mono space-y-0.5">
                      {parsedTxn.accountMask && (
                        <div>Kotak *{parsedTxn.accountMask}</div>
                      )}
                      <div>{new Date(parsedTxn.occurredAt).toLocaleDateString("en-IN")}</div>
                    </div>
                  </div>

                  {/* Duplicate Detection Warning Banner */}
                  {parseResult?.isDuplicate && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-2.5 text-amber-400">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <div className="font-bold text-foreground text-xs">Duplicate Transaction Detected</div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          {parseResult.duplicateReason ||
                            "A transaction with matching reference or merchant/amount already exists in your ledger."}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Editable Description / Payee */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-muted-foreground">
                      Description / Payee
                    </label>
                    <input
                      type="text"
                      value={editableMerchant}
                      onChange={(e) => setEditableMerchant(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg bg-card border border-border text-xs text-foreground focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* Account & Category Selection Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-muted-foreground flex items-center justify-between">
                        <span>Target Account</span>
                        {parseResult?.matchedAccount && (
                          <span className="text-[10px] text-emerald-400 font-mono">Matched by mask</span>
                        )}
                      </label>
                      <select
                        value={selectedAccountId}
                        onChange={(e) => setSelectedAccountId(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg bg-card border border-border text-xs text-foreground focus:outline-none focus:border-emerald-500"
                      >
                        <option value="">Select Account (Required)...</option>
                        {accounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name} ({acc.accountType}) — {formatPaise(acc.currentBalancePaise)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-muted-foreground flex items-center justify-between">
                        <span>Category</span>
                        {parseResult?.suggestedCategory && (
                          <span className="text-[10px] text-emerald-400 font-mono">Smart suggested</span>
                        )}
                      </label>
                      <select
                        value={selectedCategoryId}
                        onChange={(e) => setSelectedCategoryId(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg bg-card border border-border text-xs text-foreground focus:outline-none focus:border-emerald-500"
                      >
                        <option value="">Uncategorized</option>
                        {categories
                          .filter((c) => (isOutflow ? c.type === "expense" : c.type === "income"))
                          .map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  {/* Confirm Button */}
                  <div className="pt-2 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={handleClear}
                      className="px-3 py-2 rounded-xl border border-border hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-medium transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmRecord}
                      disabled={isRecording || parseResult?.isDuplicate || !selectedAccountId}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black font-semibold text-xs transition-all cursor-pointer shadow-xs active:scale-95"
                    >
                      <Check className="w-4 h-4" />
                      <span>
                        {parseResult?.isDuplicate
                          ? "Duplicate — Already Recorded"
                          : isRecording
                          ? "Recording into Ledger..."
                          : "Confirm & Record into Ledger"}
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: STATEMENT IMPORT */}
          {activeTab === "IMPORT" && (
            <div className="space-y-4">
              <div className="p-4 bg-surface border border-border rounded-xl space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
                    <FileUp className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-foreground">
                      Kotak Bank Statement Import
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      Ingest months of transaction history with offline deduplication
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-card border border-border/60 rounded-lg space-y-2 text-[11px] leading-relaxed">
                  <div className="font-semibold text-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Genuinely Supported Formats:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-muted-foreground pl-1">
                    <li>
                      <strong className="text-foreground">CSV:</strong> Standard comma-separated transaction exports from Kotak Net Banking.
                    </li>
                    <li>
                      <strong className="text-foreground">OFX:</strong> Open Financial Exchange statement files.
                    </li>
                    <li>
                      <strong className="text-foreground">QIF:</strong> Quicken Interchange Format bank records.
                    </li>
                  </ul>
                  <div className="pt-1 text-amber-400 text-[10px] flex items-center gap-1">
                    <Info className="w-3.5 h-3.5 shrink-0" />
                    <span>PDF bank statements and binary Excel (.xlsx) are not directly supported yet. Export CSV from net banking.</span>
                  </div>
                </div>

                {/* Export guide */}
                <div className="space-y-1.5 text-[11px] text-muted-foreground">
                  <span className="font-semibold text-foreground block">
                    How to Export from Kotak Net Banking:
                  </span>
                  <ol className="list-decimal list-inside space-y-1 pl-1">
                    <li>Log into Kotak Mahindra Net Banking (or Kotak 811 App).</li>
                    <li>Navigate to <strong>Accounts → Statements & Reports</strong>.</li>
                    <li>Select your date range and choose <strong>Download as CSV</strong>.</li>
                    <li>Click the button below to import the CSV file securely into Life Atlas.</li>
                  </ol>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenStatementImport?.();
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all cursor-pointer shadow-xs active:scale-95"
                  >
                    <FileUp className="w-4 h-4" />
                    <span>Open Statement Importer</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PRIVACY & ARCHITECTURE */}
          {activeTab === "PRIVACY" && (
            <div className="space-y-4">
              {/* Play Protect Explanation */}
              <div className="p-4 bg-surface border border-border rounded-xl space-y-2">
                <div className="flex items-center gap-2 font-bold text-foreground">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Why Kotak Smart Assistant Instead of Background Notification Access?</span>
                </div>
                <p className="leading-relaxed text-muted-foreground text-[11px]">
                  Google Play Protect analyzes sideloaded APKs using automated static heuristics.
                  Android&apos;s <code className="text-foreground font-mono text-[10px]">NotificationListenerService</code> grants
                  system-wide notification access, which triggers Play Protect&apos;s <code className="text-amber-400 font-mono text-[10px]">PHA:SPYWARE</code> flag
                  even on completely benign personal apps.
                </p>
                <p className="leading-relaxed text-muted-foreground text-[11px]">
                  By replacing background notification listening with explicit, user-initiated on-device parsing,
                  Life Atlas completely removes the system service heuristic trigger while preserving instant,
                  accurate transaction entry and full privacy.
                </p>
              </div>

              {/* Zero Permissions Guarantee */}
              <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl space-y-2">
                <div className="flex items-center gap-2 font-bold text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Zero Sensitive Android Permissions</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground text-[11px] leading-relaxed pl-1">
                  <li>
                    <strong>NO READ_SMS or RECEIVE_SMS:</strong> Life Atlas does not access your text message inbox.
                  </li>
                  <li>
                    <strong>NO NotificationListenerService:</strong> No system background services running.
                  </li>
                  <li>
                    <strong>NO Cloud Transmission:</strong> Parsed 100% in local device memory. No Gemini, LLM, or external APIs.
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 4: REVIEW QUEUE (If items exist) */}
          {activeTab === "REVIEW" && reviewItems.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground">Pending Review Queue</span>
                <span className="text-[10px] text-muted-foreground">Assign accounts or dismiss</span>
              </div>

              <div className="space-y-2.5">
                {reviewItems.map((item) => {
                  const txn = item.parsedTransaction;
                  const itemIsOutflow = txn.direction === "outflow";
                  return (
                    <div
                      key={item.id}
                      className="p-3.5 bg-surface border border-amber-500/30 rounded-xl space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                              itemIsOutflow
                                ? "bg-rose-500/10 text-rose-400"
                                : "bg-emerald-500/10 text-emerald-400"
                            }`}
                          >
                            {itemIsOutflow ? (
                              <ArrowDownRight className="w-4 h-4" />
                            ) : (
                              <ArrowUpRight className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-foreground text-xs">
                              {txn.merchantOrBeneficiary}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {new Date(txn.occurredAt).toLocaleString()}
                              {txn.referenceNumber ? ` • Ref: ${txn.referenceNumber}` : ""}
                            </div>
                            <div className="text-[10px] text-amber-400 mt-0.5">{item.reason}</div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div
                            className={`font-mono font-bold text-sm ${
                              itemIsOutflow ? "text-rose-400" : "text-emerald-400"
                            }`}
                          >
                            {itemIsOutflow ? "-" : "+"}
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
                            value={reviewAccounts[item.id] || ""}
                            onChange={(e) =>
                              setReviewAccounts((prev) => ({ ...prev, [item.id]: e.target.value }))
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
                            value={reviewCategories[item.id] || ""}
                            onChange={(e) =>
                              setReviewCategories((prev) => ({ ...prev, [item.id]: e.target.value }))
                            }
                            className="bg-card border border-border rounded-lg px-2 py-1 text-[11px] text-foreground flex-1 focus:outline-none"
                          >
                            <option value="">Optional Category...</option>
                            {categories
                              .filter((c) => (itemIsOutflow ? c.type === "expense" : c.type === "income"))
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
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-border bg-card/60">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Zero cloud transmission · On-device parsing only</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
