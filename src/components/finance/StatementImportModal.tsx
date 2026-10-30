"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  X,
  UploadCloud,
  FileText,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
  Check,
  FileSpreadsheet,
  Layers,
  ArrowRight,
  Sparkles,
  HelpCircle,
  Landmark,
} from "lucide-react";
import {
  FinanceAccount,
  StatementFileType,
  ImportPreviewResult,
  ImportPreviewItem,
  ColumnMapping,
  ImportService,
  formatPaise,
} from "@/lib/finance";

interface StatementImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: FinanceAccount[];
  importService: ImportService;
  onImportComplete: () => void;
}

export default function StatementImportModal({
  isOpen,
  onClose,
  accounts,
  importService,
  onImportComplete,
}: StatementImportModalProps) {
  // Flow step 1 to 5
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // File & Account state
  const [fileContent, setFileContent] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [fileSizeStr, setFileSizeStr] = useState<string>("");
  const [fileRowCount, setFileRowCount] = useState<number>(0);
  const [fileType, setFileType] = useState<StatementFileType>("csv");
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");

  // Column mapping for CSV
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvPreviewRows, setCsvPreviewRows] = useState<string[][]>([]);
  const [customMapping, setCustomMapping] = useState<ColumnMapping>({
    dateColIndex: 0,
    descriptionColIndex: 1,
    debitColIndex: 2,
    creditColIndex: 3,
    hasHeader: true,
  });

  // Preview & deduplication result
  const [previewResult, setPreviewResult] = useState<ImportPreviewResult | null>(null);
  const [previewItems, setPreviewItems] = useState<ImportPreviewItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Import completion stats
  const [importSummary, setImportSummary] = useState<{
    importedCount: number;
    skippedCount: number;
    destinationBalancePaise: number;
  } | null>(null);

  const activeAccounts = useMemo(() => accounts.filter((a) => a.status === "active"), [accounts]);
  const destinationAccount = useMemo(
    () => accounts.find((a) => a.id === selectedAccountId) || activeAccounts[0],
    [accounts, selectedAccountId, activeAccounts]
  );

  // Keep selectedAccountId synced whenever modal opens or accounts change
  useEffect(() => {
    if (isOpen) {
      if (!selectedAccountId || !activeAccounts.some((a) => a.id === selectedAccountId)) {
        if (activeAccounts.length > 0) {
          setSelectedAccountId(activeAccounts[0].id);
        }
      }
    }
  }, [isOpen, activeAccounts, selectedAccountId]);

  // Reset state when modal is closed
  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setFileContent("");
      setFileName("");
      setFileSizeStr("");
      setFileRowCount(0);
      setPreviewResult(null);
      setPreviewItems([]);
      setErrorMessage(null);
      setImportSummary(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);
    setFileName(file.name);
    setFileSizeStr(
      file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.round(file.size / 1024)} KB`
    );

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "csv") setFileType("csv");
    else if (ext === "ofx") setFileType("ofx");
    else if (ext === "qif") setFileType("qif");
    else if (ext === "pdf") {
      setErrorMessage(
        "Scanned PDFs requiring OCR or external AI parsing are not supported in offline mode. Please download a CSV or OFX statement from your bank portal for 100% private local processing."
      );
      return;
    } else {
      setErrorMessage("Unsupported file type. Please upload a .csv, .ofx, or .qif statement file.");
      return;
    }

    setIsReadingFile(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      setIsReadingFile(false);
      const text = (event.target?.result as string) || "";
      setFileContent(text);

      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      setFileRowCount(Math.max(0, lines.length - 1));

      if (ext === "csv") {
        if (lines.length > 0) {
          const headers = lines[0].split(",").map((h) => h.replace(/["']/g, "").trim());
          setCsvHeaders(headers);
          const sampleRows = lines
            .slice(1, 5)
            .map((line) => line.split(",").map((c) => c.replace(/["']/g, "").trim()));
          setCsvPreviewRows(sampleRows);

          // Auto-detect common column names
          let dateIdx = 0;
          let descIdx = 1;
          let debitIdx: number | undefined = undefined;
          let creditIdx: number | undefined = undefined;

          headers.forEach((h, idx) => {
            const lower = h.toLowerCase();
            if (lower.includes("date") || lower.includes("txn date") || lower.includes("value date")) {
              dateIdx = idx;
            } else if (lower.includes("narration") || lower.includes("description") || lower.includes("particulars") || lower.includes("remark")) {
              descIdx = idx;
            } else if (lower.includes("debit") || lower.includes("withdrawal") || lower.includes("dr")) {
              debitIdx = idx;
            } else if (lower.includes("credit") || lower.includes("deposit") || lower.includes("cr")) {
              creditIdx = idx;
            }
          });

          setCustomMapping({
            dateColIndex: dateIdx,
            descriptionColIndex: descIdx,
            debitColIndex: debitIdx !== undefined ? debitIdx : 2,
            creditColIndex: creditIdx !== undefined ? creditIdx : 3,
            hasHeader: true,
          });
        }
      }
    };
    reader.onerror = () => {
      setIsReadingFile(false);
      setErrorMessage("Failed to read file contents. Please try again.");
    };
    reader.readAsText(file);
  };

  const effectiveAccountId = selectedAccountId || activeAccounts[0]?.id || "";

  const handleProceedToDeduplication = async () => {
    if (!fileContent) {
      setErrorMessage("Please select a valid statement file first.");
      return;
    }
    if (!effectiveAccountId) {
      setErrorMessage("Please select or create an account to import into.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    try {
      const preview = await importService.previewStatement(
        fileContent,
        fileType,
        effectiveAccountId,
        fileType === "csv" ? customMapping : undefined
      );

      setPreviewResult(preview);
      setPreviewItems(preview.items);
      setStep(3);
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || "Failed to parse statement file.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSelectItem = (id: string) => {
    setPreviewItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selectedForImport: !item.selectedForImport } : item))
    );
  };

  const handleSelectAllNew = () => {
    setPreviewItems((prev) =>
      prev.map((item) => (item.status === "new" ? { ...item, selectedForImport: true } : item))
    );
  };

  const handleDeselectAll = () => {
    setPreviewItems((prev) => prev.map((item) => ({ ...item, selectedForImport: false })));
  };

  const handleCommitImport = async () => {
    if (!effectiveAccountId) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const result = await importService.commitImport(effectiveAccountId, previewItems);
      setImportSummary({
        importedCount: result.importedCount,
        skippedCount: result.skippedCount,
        destinationBalancePaise: result.destinationAccountBalancePaise,
      });
      setStep(5);
      onImportComplete();
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || "Failed to commit import.");
    } finally {
      setLoading(false);
    }
  };

  const selectedCount = previewItems.filter((i) => i.selectedForImport).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div className="relative w-full max-w-3xl my-auto max-h-[92vh] bg-surface border border-muted/80 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-fade-in-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-7 py-4 sm:py-5 border-b border-muted bg-surface/80 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-xs">
              <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
                <span>Import Bank Statement</span>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 uppercase">
                  100% Offline
                </span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                On-device parsing, automated deduplication & ledger reconciliation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground rounded-xl hover:bg-muted/40 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Navigation Pill Indicator */}
        <div className="px-5 sm:px-7 py-3 bg-muted/15 border-b border-muted flex items-center justify-between text-xs overflow-x-auto no-scrollbar shrink-0">
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((s) => {
              const isCurrent = step === s;
              const isPast = step > s;
              return (
                <React.Fragment key={s}>
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold transition-all ${
                      isCurrent
                        ? "bg-emerald-500 text-slate-950 shadow-xs shadow-emerald-500/30 scale-105"
                        : isPast
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                        : "bg-surface border border-muted text-muted-foreground/60"
                    }`}
                  >
                    {isPast ? <Check className="w-3.5 h-3.5" /> : s}
                  </div>
                  {s < 5 && (
                    <div
                      className={`w-4 sm:w-6 h-0.5 transition-colors ${
                        isPast ? "bg-emerald-500/60" : "bg-muted"
                      }`}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
          <span className="text-muted-foreground font-medium text-xs ml-3 truncate">
            {step === 1 && "1. Choose File & Account"}
            {step === 2 && "2. Map CSV Headers"}
            {step === 3 && "3. Deduplication Check"}
            {step === 4 && "4. Confirm Ledger Import"}
            {step === 5 && "5. Sync Complete"}
          </span>
        </div>

        {/* Error Alert Banner */}
        {errorMessage && (
          <div className="mx-5 sm:mx-7 mt-3 p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-2xl flex items-center gap-2.5 animate-fade-in shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span className="flex-1">{errorMessage}</span>
          </div>
        )}

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-5">
          {/* STEP 1: Upload File & Pick Account */}
          {step === 1 && (
            <div className="space-y-5 animate-fade-in">
              {/* Account Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold font-sans uppercase tracking-wider text-muted-foreground block">
                  1. Target Account *
                </label>
                {activeAccounts.length > 0 ? (
                  <div className="relative">
                    <select
                      value={effectiveAccountId}
                      onChange={(e) => setSelectedAccountId(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs bg-surface border border-muted rounded-2xl text-foreground focus:outline-none focus:border-emerald-500 transition-colors shadow-xs"
                    >
                      {activeAccounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} ({acc.accountType.toUpperCase()}) — Balance:{" "}
                          {formatPaise(acc.currentBalancePaise)}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Landmark className="w-4 h-4 shrink-0 text-amber-400" />
                      <span>No active financial accounts found. Create one first to track statements.</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Upload Drop Zone */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold font-sans uppercase tracking-wider text-muted-foreground block">
                  2. Upload Statement File (.csv, .ofx, .qif) *
                </label>
                <div
                  className={`relative border-2 border-dashed rounded-3xl p-6 sm:p-8 text-center transition-all ${
                    fileContent
                      ? "border-emerald-500/60 bg-emerald-500/5"
                      : "border-muted hover:border-emerald-500/40 bg-surface/40 hover:bg-surface/70"
                  }`}
                >
                  <input
                    type="file"
                    accept=".csv,.ofx,.qif,.pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="statement-file-input"
                  />
                  <label htmlFor="statement-file-input" className="cursor-pointer space-y-3 block">
                    <div className="w-14 h-14 rounded-2xl mx-auto bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-xs">
                      {isReadingFile ? (
                        <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                      ) : fileContent ? (
                        <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                      ) : (
                        <UploadCloud className="w-7 h-7 text-emerald-400" />
                      )}
                    </div>

                    {fileContent ? (
                      <div className="space-y-1">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-mono font-bold border border-emerald-500/30">
                          <Check className="w-3.5 h-3.5" />
                          <span>{fileName}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {fileSizeStr} • ~{fileRowCount} data transactions detected • Click to replace file
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-foreground">
                          {fileName ? fileName : "Tap or click to select bank statement"}
                        </p>
                        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                          Supports CSV, OFX, and QIF from Kotak, HDFC, SBI, ICICI, Axis, and all major Indian banks.
                        </p>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              {/* Offline Privacy Guarantee */}
              <div className="p-3.5 bg-surface/60 border border-muted rounded-2xl flex items-start gap-3 text-xs text-muted-foreground shadow-xs">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-foreground">Zero-Cloud Offline Encryption</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                    Statements are parsed and reconciled strictly inside your browser/phone&apos;s local IndexedDB. No files, passwords, account numbers, or transactions are ever transmitted externally.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: CSV Column Mapping */}
          {step === 2 && (
            <div className="space-y-5 animate-fade-in">
              <div className="p-3.5 rounded-2xl bg-surface/60 border border-muted text-xs text-muted-foreground">
                Confirm or adjust the column headers detected from your CSV file. This ensures dates, descriptions, and withdrawal/deposit amounts map correctly into your ledger.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground block">
                    Date Column *
                  </label>
                  <select
                    value={customMapping.dateColIndex}
                    onChange={(e) =>
                      setCustomMapping({ ...customMapping, dateColIndex: parseInt(e.target.value, 10) })
                    }
                    className="w-full px-2.5 py-2 text-xs bg-surface border border-muted rounded-xl text-foreground focus:outline-none focus:border-emerald-500"
                  >
                    {csvHeaders.map((h, i) => (
                      <option key={i} value={i}>
                        {h} (Col {i + 1})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground block">
                    Narration / Desc *
                  </label>
                  <select
                    value={customMapping.descriptionColIndex}
                    onChange={(e) =>
                      setCustomMapping({ ...customMapping, descriptionColIndex: parseInt(e.target.value, 10) })
                    }
                    className="w-full px-2.5 py-2 text-xs bg-surface border border-muted rounded-xl text-foreground focus:outline-none focus:border-emerald-500"
                  >
                    {csvHeaders.map((h, i) => (
                      <option key={i} value={i}>
                        {h} (Col {i + 1})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground block">
                    Withdrawal / Debit
                  </label>
                  <select
                    value={customMapping.debitColIndex ?? ""}
                    onChange={(e) =>
                      setCustomMapping({
                        ...customMapping,
                        debitColIndex: e.target.value !== "" ? parseInt(e.target.value, 10) : undefined,
                      })
                    }
                    className="w-full px-2.5 py-2 text-xs bg-surface border border-muted rounded-xl text-foreground focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">-- None --</option>
                    {csvHeaders.map((h, i) => (
                      <option key={i} value={i}>
                        {h} (Col {i + 1})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground block">
                    Deposit / Credit
                  </label>
                  <select
                    value={customMapping.creditColIndex ?? ""}
                    onChange={(e) =>
                      setCustomMapping({
                        ...customMapping,
                        creditColIndex: e.target.value !== "" ? parseInt(e.target.value, 10) : undefined,
                      })
                    }
                    className="w-full px-2.5 py-2 text-xs bg-surface border border-muted rounded-xl text-foreground focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">-- None --</option>
                    {csvHeaders.map((h, i) => (
                      <option key={i} value={i}>
                        {h} (Col {i + 1})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Sample Data Table */}
              <div className="border border-muted rounded-2xl overflow-hidden shadow-xs">
                <div className="bg-muted/30 px-3.5 py-2 text-xs font-semibold text-foreground border-b border-muted flex items-center justify-between">
                  <span>First 4 Sample Rows</span>
                  <span className="text-[10px] text-muted-foreground font-mono">Row 1 = Headers</span>
                </div>
                <div className="overflow-x-auto text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-muted/15 border-b border-muted text-muted-foreground">
                      <tr>
                        {csvHeaders.map((h, i) => (
                          <th key={i} className="px-3 py-2 whitespace-nowrap font-mono text-[11px]">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-muted/40">
                      {csvPreviewRows.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-muted/10 transition-colors">
                          {row.map((cell, cIdx) => (
                            <td key={cIdx} className="px-3 py-2 whitespace-nowrap text-foreground font-sans">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Deduplication Inspection & Category Preview */}
          {step === 3 && previewResult && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-surface/70 border border-muted rounded-2xl text-xs shadow-xs">
                <div className="flex items-center gap-4">
                  <span className="text-muted-foreground">
                    Total: <strong className="text-foreground">{previewResult.totalParsed}</strong>
                  </span>
                  <span className="text-emerald-400">
                    New: <strong>{previewResult.newCount}</strong>
                  </span>
                  <span className="text-amber-400">
                    Duplicates: <strong>{previewResult.duplicateCount}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSelectAllNew}
                    className="px-2.5 py-1 text-[11px] rounded-lg bg-surface border border-muted hover:border-emerald-500 text-foreground transition-all cursor-pointer"
                  >
                    Select All New
                  </button>
                  <button
                    onClick={handleDeselectAll}
                    className="px-2.5 py-1 text-[11px] rounded-lg bg-surface border border-muted hover:border-foreground/30 text-muted-foreground transition-all cursor-pointer"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              <div className="space-y-2 max-h-[46vh] overflow-y-auto pr-1">
                {previewItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleToggleSelectItem(item.id)}
                    className={`p-3.5 border rounded-2xl flex items-center justify-between gap-3 text-xs cursor-pointer transition-all ${
                      item.selectedForImport
                        ? "bg-surface border-emerald-500/50 shadow-xs ring-1 ring-emerald-500/20"
                        : "bg-surface/30 border-muted/50 opacity-60 hover:opacity-90"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={item.selectedForImport}
                        onChange={() => {}} // handled by parent div click
                        className="w-4 h-4 rounded border-muted text-emerald-500 focus:ring-emerald-500 cursor-pointer shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground truncate max-w-xs sm:max-w-md">
                            {item.description}
                          </span>
                          {item.status === "duplicate" ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 font-mono font-medium border border-amber-500/30 shrink-0">
                              Duplicate
                            </span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 font-mono font-medium border border-emerald-500/30 shrink-0">
                              New
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                          {item.occurredAt.split("T")[0]}
                          {item.matchExplanation ? ` • ${item.matchExplanation}` : ""}
                          {item.duplicateReason ? ` • ${item.duplicateReason}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`font-mono font-bold text-sm ${
                          item.direction === "inflow" ? "text-emerald-400" : "text-foreground"
                        }`}
                      >
                        {item.direction === "inflow" ? "+" : "-"} {formatPaise(item.amountPaise)}
                      </span>
                      {item.suggestedCategoryName && (
                        <p className="text-[10px] text-teal-400 mt-0.5 font-medium">
                          {item.suggestedCategoryName}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 4: Confirmation */}
          {step === 4 && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-5 bg-surface/70 border border-muted rounded-3xl space-y-4 shadow-soft">
                <h3 className="text-sm font-bold text-foreground tracking-tight">Ledger Sync Summary</h3>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Destination Account:</span>
                    <span className="font-semibold text-foreground text-sm mt-0.5 block truncate">
                      {destinationAccount?.name}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Transactions to Commit:</span>
                    <span className="font-mono font-bold text-emerald-400 text-sm mt-0.5 block">
                      {selectedCount} entries
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Duplicates Excluded:</span>
                    <span className="font-mono font-bold text-amber-400 text-sm mt-0.5 block">
                      {previewItems.length - selectedCount} skipped
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Accounting Invariant:</span>
                    <span className="font-semibold text-emerald-400 text-xs mt-0.5 block">
                      Atomic Dual-Ledger Safe
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-3.5 bg-muted/20 border border-muted rounded-2xl text-xs text-muted-foreground">
                Committing this import will update your account balances and create an irreversible audit log. You can review all imported transactions in the ledger at any time.
              </div>
            </div>
          )}

          {/* STEP 5: Success Summary */}
          {step === 5 && importSummary && (
            <div className="py-8 text-center space-y-5 animate-fade-in">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-foreground">Import Completed Successfully!</h3>
                <p className="text-xs text-muted-foreground">
                  Your offline ledger and balances are now synchronized.
                </p>
              </div>

              <div className="max-w-md mx-auto p-5 bg-surface/80 border border-muted rounded-3xl grid grid-cols-2 gap-4 text-xs shadow-soft">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Imported to Ledger:</span>
                  <span className="font-mono font-bold text-lg text-emerald-400 mt-0.5 block">
                    {importSummary.importedCount}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Duplicates Skipped:</span>
                  <span className="font-mono font-bold text-lg text-amber-400 mt-0.5 block">
                    {importSummary.skippedCount}
                  </span>
                </div>
                <div className="col-span-2 pt-3 border-t border-muted">
                  <span className="text-muted-foreground block text-[11px]">Updated Account Balance:</span>
                  <span className="font-mono font-bold text-lg text-foreground mt-0.5 block">
                    {formatPaise(importSummary.destinationBalancePaise)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="flex items-center justify-between px-5 sm:px-7 py-4 border-t border-muted bg-surface/80 backdrop-blur-md shrink-0">
          {step === 1 && (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (fileType === "csv" && csvHeaders.length > 0) {
                    setStep(2);
                  } else {
                    handleProceedToDeduplication();
                  }
                }}
                disabled={!fileContent || !effectiveAccountId || isReadingFile}
                className="px-5 py-2.5 text-xs font-bold rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 flex items-center gap-2 cursor-pointer disabled:opacity-40 transition-all shadow-xs"
              >
                <span>Continue</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-muted text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button
                onClick={handleProceedToDeduplication}
                disabled={loading}
                className="px-5 py-2.5 text-xs font-bold rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 flex items-center gap-2 cursor-pointer disabled:opacity-40 transition-all shadow-xs"
              >
                <span>{loading ? "Checking Duplicates..." : "Verify & Deduplicate"}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}

          {step === 3 && (
            <>
              <button
                onClick={() => setStep(fileType === "csv" ? 2 : 1)}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-muted text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button
                onClick={() => setStep(4)}
                disabled={selectedCount === 0}
                className="px-5 py-2.5 text-xs font-bold rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 flex items-center gap-2 cursor-pointer disabled:opacity-40 transition-all shadow-xs"
              >
                <span>Review {selectedCount} Transactions</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}

          {step === 4 && (
            <>
              <button
                onClick={() => setStep(3)}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-muted text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button
                onClick={handleCommitImport}
                disabled={loading || selectedCount === 0}
                className="px-5 py-2.5 text-xs font-bold rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 flex items-center gap-2 cursor-pointer disabled:opacity-40 transition-all shadow-xs"
              >
                <Check className="w-4 h-4" />
                <span>{loading ? "Importing to Ledger..." : "Commit & Synchronize"}</span>
              </button>
            </>
          )}

          {step === 5 && (
            <div className="w-full flex justify-end">
              <button
                onClick={onClose}
                className="px-6 py-2.5 text-xs font-bold rounded-xl bg-foreground text-background hover:opacity-90 cursor-pointer shadow-xs"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
