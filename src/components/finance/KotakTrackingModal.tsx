"use client";

import MerchantImage from "./MerchantImage";
import FinanceSelect from "@/components/finance/FinanceSelect";

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
  MessageSquare,
  Tag,
  ChevronDown,
  ChevronRight,
  SlidersHorizontal,
  ArrowLeft,
} from "lucide-react";
import { useLockBodyScroll } from "@/lib/vault/useLockBodyScroll";
import {
  NotificationTrackingService,
  FinanceAccount,
  FinanceCategory,
  NotificationReviewItem,
  formatPaise,
  ParseAlertResult,
  NotificationTrackingStatus,
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

type ModalTab = "AUTOMATIC" | "PASTE" | "IMPORT" | "PRIVACY" | "REVIEW";

export default function KotakTrackingModal({
  isOpen,
  onClose,
  trackingService,
  accounts,
  categories,
  onTransactionsUpdated,
  onOpenStatementImport,
}: KotakTrackingModalProps) {
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ModalTab>("REVIEW");
  const [alertText, setAlertText] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [parseResult, setParseResult] = useState<ParseAlertResult | null>(null);

  const [trackingStatus, setTrackingStatus] = useState<NotificationTrackingStatus | null>(null);
  const [isChangingTracking, setIsChangingTracking] = useState(false);

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
  const [focusedEvent, setFocusedEvent] = useState<string | null>(null);
  const [busyReviewId, setBusyReviewId] = useState<string | null>(null);
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
      trackingService.drainPendingNotifications().then(() => {
        loadReviewQueue();
        if (trackingService.getReviewQueue().length) setActiveTab("REVIEW");
      }).catch(console.warn);
      loadReviewQueue();
    }
  }, [isOpen, loadReviewQueue, trackingService]);

  useEffect(() => {
    if (!isOpen) return;
    const update = () => {
      void trackingService.getStatus().then(setTrackingStatus).catch(console.warn);
      loadReviewQueue();
    };
    update();
    window.addEventListener("focus", update);
    window.addEventListener("finance-notifications-updated", update);
    return () => {
      window.removeEventListener("focus", update);
      window.removeEventListener("finance-notifications-updated", update);
    };
  }, [isOpen, trackingService, loadReviewQueue]);

  const changeTracking = async (enabled: boolean) => {
    setIsChangingTracking(true);
    try {
      if (enabled) await trackingService.requestReviewNotifications();
      await trackingService.setTrackingEnabled(enabled);
      if (enabled && !trackingStatus?.permissionGranted) await trackingService.requestNotificationAccess();
      setTrackingStatus(await trackingService.getStatus());
      onTransactionsUpdated();
    } catch {
      setFeedbackMessage({ type: "error", text: "Could not change notification tracking. Check Android notification access and try again." });
    } finally { setIsChangingTracking(false); }
  };

  useEffect(() => {
    if (isOpen) setFocusedEvent(new URLSearchParams(window.location.search).get("event"));
  }, [isOpen]);
  useEffect(() => {
    if (!isOpen || activeTab !== "REVIEW" || !focusedEvent) return;
    const card = document.getElementById(`finance-review-${focusedEvent}`);
    card?.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [isOpen, activeTab, focusedEvent, reviewItems]);

  useLockBodyScroll(isOpen);
  useEffect(() => {
    if (!isOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [isOpen, onClose]);
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
        text: "Could not save this transaction. Check the details and try again.",
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
    const item = reviewItems.find((entry) => entry.id === itemId);
    const accountId = reviewAccounts[itemId] ?? item?.candidateAccountIds[0];
    if (!accountId) {
      setFeedbackMessage({
        type: "error",
        text: "Please select an account for this transaction.",
      });
      return;
    }
    const categoryId = reviewCategories[itemId] ?? item?.suggestedCategoryId;
    if (!categoryId) { setFeedbackMessage({ type: "error", text: "Choose a category before approving." }); return; }
    setBusyReviewId(itemId);

    try {
      await trackingService.resolveReviewItem(itemId, accountId, categoryId);
      loadReviewQueue();
      onTransactionsUpdated();
      setFeedbackMessage({
        type: "success",
        text: "Transaction approved and saved.",
      });
    } catch (e) {
      console.error(e);
      setFeedbackMessage({
        type: "error",
        text: "Failed to record reviewed transaction. Your approval stays queued for retry.",
      });
    } finally { setBusyReviewId(null); }
  };

  const handleDismissReviewItem = async (itemId: string) => {
    try { await trackingService.dismissReviewItem(itemId); } catch {
      setFeedbackMessage({ type: "error", text: "Could not dismiss this alert. Please try again." });
      return;
    }
    loadReviewQueue();
    onTransactionsUpdated();
    setFeedbackMessage({
      type: "info",
      text: "Transaction dismissed. Your balances were not changed.",
    });
  };

  const activeReviewId = reviewItems.find(item => item.rawEventId === focusedEvent)?.id ?? (reviewItems.some(item => item.id === selectedReviewId) ? selectedReviewId : reviewItems[0]?.id);
  const parsedTxn = parseResult?.success ? parseResult.parsed : null;
  const isOutflow = parsedTxn?.direction === "outflow";

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="message-import-title" className="message-inbox fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="inbox-window relative w-full max-w-2xl max-h-[92vh] bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <header className="inbox-header review-masthead">
          <button onClick={onClose} aria-label="Close message import" className="review-back"><ArrowLeft size={21}/></button>
          <div><h2 id="message-import-title">Bank messages</h2><p>Review. Confirm. Carry on.</p></div>
          <span className="review-private"><ShieldCheck size={17}/><span>On device</span></span>
        </header>
        <div className="review-toolbar"><nav aria-label="Message tools"><button onClick={()=>setActiveTab("REVIEW")} aria-current={activeTab==="REVIEW" ? "page" : undefined}>Inbox <b>{reviewItems.length}</b></button><button onClick={()=>setActiveTab("AUTOMATIC")} aria-current={activeTab==="AUTOMATIC" ? "page" : undefined}><SlidersHorizontal size={14}/>Capture</button></nav><details className="review-more"><summary>More <ChevronDown size={14}/></summary><div>{([["PASTE","Paste a message"],["IMPORT","Import statement"],["PRIVACY","Privacy & access"]] as const).map(([id,label])=><button key={id} onClick={event=>{setActiveTab(id);event.currentTarget.closest("details")?.removeAttribute("open");}}>{label}<ChevronRight size={14}/></button>)}</div></details></div>
        {/* Feedback Banner */}
        {feedbackMessage && (
          <div
            className={`px-6 py-2.5 text-xs flex items-center justify-between border-b ${
              feedbackMessage.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : feedbackMessage.type === "error"
                ? "bg-rose-50 border-rose-200 text-rose-800"
                : "bg-blue-50 border-blue-200 text-blue-800"
            }`}
          >
            <div className="flex items-center gap-2">
              {feedbackMessage.type === "success" && <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-700" />}
              {feedbackMessage.type === "error" && <AlertTriangle className="w-4 h-4 shrink-0 text-rose-700" />}
              {feedbackMessage.type === "info" && <Info className="w-4 h-4 shrink-0 text-blue-700" />}
              <span className="font-medium">{feedbackMessage.text}</span>
            </div>
            <button
              onClick={() => setFeedbackMessage(null)}
              className="text-xs hover:underline cursor-pointer opacity-80 hover:opacity-100 font-semibold"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Scrollable Content */}
        <div className="inbox-body flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          {activeTab === "AUTOMATIC" && (
            <div className="space-y-5">
              <div className="message-instructions"><MessageSquare size={24} /><div><h3>Your bank alerts, organised.</h3><p>Allow Atlas to capture new Kotak transaction notifications from Google Messages. Every transaction stays in Review. Check the suggested category, change it if needed, and approve before it affects your balances.</p></div></div>
              {!trackingStatus ? <p role="status">Checking device support…</p> : !trackingStatus.isNativeAndroid ? (
                <div className="p-5 rounded-xl border border-slate-200 space-y-2"><h3>Available in the updated Android app</h3><p className="text-slate-600 leading-relaxed">Automatic capture needs the Atlas Android app with the bank-notification plugin. In a browser or an older app version, use the Message tab to paste an alert.</p></div>
              ) : (
                <>
                  <div className="p-5 rounded-xl border border-slate-200 space-y-4">
                    <div className="flex justify-between items-center gap-3"><h3>Google Messages capture</h3><span className="font-semibold text-emerald-800">{trackingStatus.enabled && trackingStatus.permissionGranted ? "Active" : trackingStatus.enabled ? "Permission needed" : "Off"}</span></div>
                    <p className="leading-relaxed text-slate-600">Android grants access to notifications broadly. Atlas filters for Kotak transaction alerts from Google Messages before saving anything. It does not read your SMS history. You can turn capture off at any time.</p>
                    <button disabled={isChangingTracking} onClick={() => changeTracking(!trackingStatus.enabled)} className="w-full rounded-xl bg-emerald-800 text-white px-4 py-3 font-semibold disabled:opacity-50">{isChangingTracking ? "Updating…" : trackingStatus.enabled ? "Turn off capture" : "Enable automatic capture"}</button>
                    {trackingStatus.enabled && !trackingStatus.permissionGranted && <button onClick={() => changeTracking(true)} disabled={isChangingTracking} className="w-full rounded-xl border border-emerald-200 text-emerald-800 px-4 py-3 font-semibold">Open Android notification access</button>}
                    <p className="text-slate-500 leading-relaxed">In Android settings, allow “Atlas bank alerts (Google Messages)”. Keep transaction notification previews enabled in Google Messages. On some Android versions, sideloaded apps need “Allow restricted settings” in App info first.</p>
                  </div>
                  <button onClick={async () => { const granted = await trackingService.requestReviewNotifications(); setFeedbackMessage({ type: granted ? "success" : "info", text: granted ? "Review notifications are enabled. Tap an Atlas alert to approve its transaction." : "Enable Atlas notifications in Android App info to receive review alerts. Review is always available here." }); }} className="w-full rounded-xl border border-slate-200 py-3 font-semibold">Enable review notifications</button>
                  <div className="grid grid-cols-3 gap-3 text-center"><div className="rounded-xl bg-slate-50 p-3"><strong className="block text-xl">{trackingStatus.eventsReceivedCount}</strong><span>Captured</span></div><div className="rounded-xl bg-slate-50 p-3"><strong className="block text-xl">{trackingStatus.pendingCount}</strong><span>Pending</span></div><div className="rounded-xl bg-slate-50 p-3"><strong className="block text-xl">{trackingStatus.duplicatesIgnoredCount}</strong><span>Duplicates skipped</span></div></div>
                  {trackingStatus.lastError && <p role="alert" className="text-amber-800">{trackingStatus.lastError}</p>}
                  <p className="text-slate-600 leading-relaxed">Alerts are queued on this device while Finance is closed. Open Finance to review them. They are recorded only after you approve. Match your Kotak account’s last four digits in Accounts. Tap an Atlas notification to open Review. Old messages and notifications with hidden content cannot be captured.</p>
                  <button className="w-full rounded-xl border border-slate-200 py-3 font-semibold" onClick={async () => { try { await trackingService.drainPendingNotifications(); setTrackingStatus(await trackingService.getStatus()); loadReviewQueue(); onTransactionsUpdated(); } catch { setFeedbackMessage({ type: "error", text: "Import failed. Your pending alerts remain saved for retry." }); } }}>Import pending alerts now</button>
                </>
              )}
            </div>
          )}
          {/* TAB 1: PASTE & RECORD */}
          {activeTab === "PASTE" && (
            <div className="space-y-4">
              <div className="message-instructions"><MessageSquare size={22} /><div><h3>From message to money insight.</h3><p>In Google Messages, open a Kotak transaction SMS, press and hold the message, then copy it. Paste it below to review the amount, account, and category.</p></div></div>
              {/* Text Input Box */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-900 flex items-center gap-1.5">
                    <span>Bank message</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handlePasteFromClipboard}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-800 transition-all cursor-pointer font-medium text-[11px]"
                    >
                      <Clipboard className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Paste Clipboard</span>
                    </button>
                    {alertText && (
                      <button
                        type="button"
                        onClick={handleClear}
                        className="text-[11px] text-slate-500 hover:text-slate-800 cursor-pointer"
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
                  className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono text-xs focus:outline-none focus:border-red-500 focus:bg-white transition-colors placeholder:text-slate-400 resize-none"
                />

                {/* Sample helpers */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] text-slate-500">Quick test samples:</span>
                  <button
                    type="button"
                    onClick={() => handleLoadSample("swiggy")}
                    className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-[10px] text-slate-700 cursor-pointer transition-colors font-medium"
                  >
                    + Swiggy ₹380
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLoadSample("salary")}
                    className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-[10px] text-slate-700 cursor-pointer transition-colors font-medium"
                  >
                    + Salary ₹45,000
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLoadSample("zepto")}
                    className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-[10px] text-slate-700 cursor-pointer transition-colors font-medium"
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
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs transition-all disabled:opacity-40 cursor-pointer shadow-xs active:scale-95"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isParsing ? "Parsing Alert..." : "Parse Transaction"}</span>
                </button>
              </div>

              {/* Parsed Result Preview Card */}
              {parsedTxn && (
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/80 space-y-4 animate-in fade-in duration-200">
                  {/* Header preview row */}
                  <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                          isOutflow
                            ? "bg-rose-50 border-rose-200 text-rose-700"
                            : "bg-emerald-50 border-emerald-200 text-emerald-700"
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
                                ? "bg-rose-50 text-rose-800 border border-rose-200"
                                : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                            }`}
                          >
                            {isOutflow ? "OUTFLOW (DEBIT)" : "INFLOW (CREDIT)"}
                          </span>
                          {parsedTxn.referenceNumber && (
                            <span className="font-mono text-[10px] text-slate-500">
                              Ref: {parsedTxn.referenceNumber}
                            </span>
                          )}
                        </div>
                        <div className="font-display text-2xl font-bold text-slate-900 mt-1">
                          {isOutflow ? "-" : "+"}
                          {formatPaise(parsedTxn.amountPaise)}
                        </div>
                      </div>
                    </div>

                    <div className="text-right text-[10px] text-slate-500 font-mono space-y-0.5">
                      {parsedTxn.accountMask && (
                        <div>Kotak *{parsedTxn.accountMask}</div>
                      )}
                      <div>{new Date(parsedTxn.occurredAt).toLocaleDateString("en-IN")}</div>
                    </div>
                  </div>

                  {/* Duplicate Detection Warning Banner */}
                  {parseResult?.isDuplicate && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-amber-800">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
                      <div className="space-y-0.5">
                        <div className="font-bold text-slate-900 text-xs">Duplicate Transaction Detected</div>
                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          {parseResult.duplicateReason ||
                            "A transaction with matching reference or merchant/amount already exists in your ledger."}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Editable Description / Payee */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-700">
                      Description / Payee
                    </label>
                    <input
                      type="text"
                      value={editableMerchant}
                      onChange={(e) => setEditableMerchant(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
                    />
                  </div>

                  {/* Account & Category Selection Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-700 flex items-center justify-between">
                        <span>Target Account</span>
                        {parseResult?.matchedAccount && (
                          <span className="text-[10px] text-emerald-700 font-mono font-semibold">Matched by mask</span>
                        )}
                      </label>
                      <FinanceSelect
                        value={selectedAccountId}
                        onChange={(e) => setSelectedAccountId(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
                      >
                        <option value="">Select Account (Required)...</option>
                        {accounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name} ({acc.accountType}) — {formatPaise(acc.currentBalancePaise)}
                          </option>
                        ))}
                      </FinanceSelect>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-700 flex items-center justify-between">
                        <span>Category</span>
                        {parseResult?.suggestedCategory && (
                          <span className="text-[10px] text-emerald-700 font-mono font-semibold">Smart suggested</span>
                        )}
                      </label>
                      <FinanceSelect
                        value={selectedCategoryId}
                        onChange={(e) => setSelectedCategoryId(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
                      >
                        <option value="">Uncategorized</option>
                        {categories
                          .filter((c) => (isOutflow ? c.type === "expense" : c.type === "income"))
                          .map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.name}
                            </option>
                          ))}
                      </FinanceSelect>
                    </div>
                  </div>

                  {/* Confirm Button */}
                  <div className="pt-2 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={handleClear}
                      className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-900 text-xs font-medium transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmRecord}
                      disabled={isRecording || parseResult?.isDuplicate || !selectedAccountId}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-semibold text-xs transition-all cursor-pointer shadow-xs active:scale-95"
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
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-200">
                    <FileUp className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-slate-900">
                      Kotak Bank Statement Import
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Ingest months of transaction history with offline deduplication
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2 text-[11px] leading-relaxed shadow-soft">
                  <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Genuinely Supported Formats:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-slate-600 pl-1">
                    <li>
                      <strong className="text-slate-900">CSV:</strong> Standard comma-separated transaction exports from Kotak Net Banking.
                    </li>
                    <li>
                      <strong className="text-slate-900">OFX:</strong> Open Financial Exchange statement files.
                    </li>
                    <li>
                      <strong className="text-slate-900">QIF:</strong> Quicken Interchange Format bank records.
                    </li>
                  </ul>
                  <div className="pt-1 text-amber-800 text-[10px] flex items-center gap-1 font-medium">
                    <Info className="w-3.5 h-3.5 shrink-0 text-amber-700" />
                    <span>PDF bank statements and binary Excel (.xlsx) are not directly supported yet. Export CSV from net banking.</span>
                  </div>
                </div>

                {/* Export guide */}
                <div className="space-y-1.5 text-[11px] text-slate-600">
                  <span className="font-semibold text-slate-900 block">
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
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-all cursor-pointer shadow-xs active:scale-95"
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
              <div className="message-instructions"><ShieldCheck size={24} /><div><h3>You choose what to import.</h3><p>Only the message you paste is parsed on this device. Atlas does not read your Google Messages inbox. Optional automatic capture listens for new Kotak transaction notifications after you enable it and grant Android notification access. Check the suggested transaction before saving; duplicate checks help prevent recording the same alert twice.</p></div></div>

            </div>
          )}

          {/* TAB 4: REVIEW QUEUE (If items exist) */}
          {activeTab === "REVIEW" && reviewItems.length === 0 && <div className="finance-review-empty"><CheckCircle2 size={40} /><h3>You’re all caught up.</h3><p>New bank messages will appear here for your approval.</p></div>}
          {activeTab === "REVIEW" && reviewItems.length > 0 && (
            <div className="space-y-3">
              <div className="inbox-summary"><div><span>YOUR MONEY MOVES</span><h3>{reviewItems.length} awaiting approval</h3></div><span className="review-status-dot">Needs your review</span></div>
              <div className="review-queue">
                {reviewItems.map((item) => {
                  const txn = item.parsedTransaction;
                  const itemIsOutflow = txn.direction === "outflow";
                  const suggested = categories.find((category) => category.id === item.suggestedCategoryId);
                  return (
                    <div
                      key={item.id}
                      id={`finance-review-${item.rawEventId}`}
                      data-focused={focusedEvent === item.rawEventId}
                      className="finance-review-card inbox-transaction"
                      data-expanded={activeReviewId===item.id}
                    >
                      <button className="review-payment" aria-expanded={activeReviewId===item.id} aria-controls={`review-editor-${item.id}`} onClick={()=>{setFocusedEvent(null);setSelectedReviewId(item.id);}}>
                        <MerchantImage merchant={txn.merchantOrBeneficiary} category={suggested?.name} direction={txn.direction} className="review-merchant-image"/>
                        <span className="inbox-payee"><strong>{txn.merchantOrBeneficiary}</strong><span>{new Date(txn.occurredAt).toLocaleDateString("en-IN",{day:"numeric",month:"short"})} · {suggested?.name || "Choose category"}</span></span>
                        <span className="review-payment-value"><strong className="inbox-amount">{itemIsOutflow ? "−" : "+"}{formatPaise(txn.amountPaise)}</strong><span>{activeReviewId===item.id ? "Reviewing" : "Review"}<ChevronRight size={12}/></span></span>
                      </button>
                      {activeReviewId===item.id && <div id={`review-editor-${item.id}`} className="review-editor">
                      <div className="review-suggestion"><Sparkles size={15}/><span><strong>{suggested ? `Suggested: ${suggested.name}` : "Choose a category"}</strong><small>Check the category before saving this payment.</small></span></div>
                      {/* Assignment Row */}
                      <div className="inbox-assignment">
                        <div className="inbox-fields">
                          <label>Account<FinanceSelect
                            disabled={busyReviewId !== null} aria-label="Transaction account" value={reviewAccounts[item.id] ?? item.candidateAccountIds[0] ?? ""}
                            onChange={(e) =>
                              setReviewAccounts((prev) => ({ ...prev, [item.id]: e.target.value }))
                            }
                            className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-[11px] text-slate-900 flex-1 focus:outline-none focus:border-emerald-600"
                          >
                            <option value="">Select Account...</option>
                            {accounts.map((acc) => (
                              <option key={acc.id} value={acc.id}>
                                {acc.name}
                              </option>
                            ))}
                          </FinanceSelect></label>

                          <label>Category<FinanceSelect
                            disabled={busyReviewId !== null} aria-label="Transaction category" value={reviewCategories[item.id] ?? item.suggestedCategoryId ?? ""}
                            onChange={(e) =>
                              setReviewCategories((prev) => ({ ...prev, [item.id]: e.target.value }))
                            }
                            className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-[11px] text-slate-900 flex-1 focus:outline-none focus:border-emerald-600"
                          >
                            <option value="">Choose Category...</option>
                            {categories
                              .filter((c) => (itemIsOutflow ? c.type === "expense" : c.type === "income"))
                              .map((cat) => (
                                <option key={cat.id} value={cat.id}>
                                  {cat.name}
                                </option>
                              ))}
                          </FinanceSelect></label>
                        </div>

                        <div className="inbox-actions">
                          <button
                            disabled={busyReviewId !== null || !(reviewAccounts[item.id] ?? item.candidateAccountIds[0]) || !(reviewCategories[item.id] ?? item.suggestedCategoryId)}
                            onClick={() => handleResolveReviewItem(item.id)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] transition-all cursor-pointer flex items-center gap-1 shadow-xs"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>{busyReviewId === item.id ? "Saving…" : "Approve transaction"}</span>
                          </button>
                          <button
                            disabled={busyReviewId !== null}
                            onClick={() => handleDismissReviewItem(item.id)}
                            className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-900 text-[11px] transition-all cursor-pointer flex items-center gap-1"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            <span>Dismiss</span>
                          </button>
                        </div>
                      </div>
                      </div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="inbox-footnote"><ShieldCheck size={14}/><span>Your balance updates only after approval.</span></div>
      </div>
    </div>
  );
}
