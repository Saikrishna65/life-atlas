"use client";

import React, { useState, useMemo } from "react";
import {
  X,
  UploadCloud,
  FileText,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  ShieldCheck,
  Check,
  Filter,
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
  const [fileType, setFileType] = useState<StatementFileType>("csv");
  const [selectedAccountId, setSelectedAccountId] = useState<string>(accounts[0]?.id || "");

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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Import completion stats
  const [importSummary, setImportSummary] = useState<{
    importedCount: number;
    skippedCount: number;
    destinationBalancePaise: number;
  } | null>(null);

  const activeAccounts = useMemo(() => accounts.filter((a) => a.status === "active"), [accounts]);
  const destinationAccount = useMemo(
    () => accounts.find((a) => a.id === selectedAccountId),
    [accounts, selectedAccountId]
  );

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);
    setFileName(file.name);

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "csv") setFileType("csv");
    else if (ext === "ofx") setFileType("ofx");
    else if (ext === "qif") setFileType("qif");
    else if (ext === "pdf") {
      setErrorMessage(
        "Scanned PDFs requiring OCR or external AI parsing are not supported in this offline phase. Please download a CSV or OFX statement from your bank's portal for 100% private local processing."
      );
      return;
    } else {
      setErrorMessage("Unsupported file type. Please upload a .csv, .ofx, or .qif file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setFileContent(text);

      if (ext === "csv") {
        // Parse first few rows for header preview
        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length > 0) {
          const headers = lines[0].split(",").map((h) => h.replace(/["']/g, "").trim());
          setCsvHeaders(headers);
          const sampleRows = lines.slice(1, 4).map((line) => line.split(",").map((c) => c.replace(/["']/g, "").trim()));
          setCsvPreviewRows(sampleRows);
        }
      }
    };
    reader.readAsText(file);
  };

  const handleProceedToDeduplication = async () => {
    if (!fileContent) {
      setErrorMessage("Please select a file to import.");
      return;
    }
    if (!selectedAccountId) {
      setErrorMessage("Please select a destination account.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    try {
      const preview = await importService.previewStatement(
        fileContent,
        fileType,
        selectedAccountId,
        fileType === "csv" ? customMapping : undefined
      );

      setPreviewResult(preview);
      setPreviewItems(preview.items);
      setStep(3);
    } catch (err: unknown) {
      setErrorMessage((err as Error).message);
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
    setLoading(true);
    setErrorMessage(null);
    try {
      const result = await importService.commitImport(selectedAccountId, previewItems);
      setImportSummary({
        importedCount: result.importedCount,
        skippedCount: result.skippedCount,
        destinationBalancePaise: result.destinationAccountBalancePaise,
      });
      setStep(5);
      onImportComplete();
    } catch (err: unknown) {
      setErrorMessage((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const selectedCount = previewItems.filter((i) => i.selectedForImport).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-3xl max-h-[92vh] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Import Bank Statement</h2>
              <p className="text-xs text-muted-foreground">Offline parsing, deduplication, and ledger synchronization</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Progress Bar */}
        <div className="px-6 py-2.5 bg-muted/20 border-b border-border flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((s) => (
              <React.Fragment key={s}>
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                    step === s
                      ? "bg-blue-500 text-white"
                      : step > s
                      ? "bg-emerald-500 text-white"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step > s ? <Check className="w-3.5 h-3.5" /> : s}
                </div>
                {s < 5 && <div className={`w-6 h-0.5 ${step > s ? "bg-emerald-500" : "bg-border"}`} />}
              </React.Fragment>
            ))}
          </div>
          <span className="text-muted-foreground font-medium text-[11px]">
            {step === 1 && "Step 1: Choose File & Account"}
            {step === 2 && "Step 2: Map Headers"}
            {step === 3 && "Step 3: Deduplication & Categories"}
            {step === 4 && "Step 4: Confirm Import"}
            {step === 5 && "Step 5: Finished"}
          </span>
        </div>

        {/* Error banner */}
        {errorMessage && (
          <div className="mx-6 mt-3 px-3 py-2 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* STEP 1: Upload File & Pick Account */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1.5">
                  1. Select Destination Account *
                </label>
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {activeAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.accountType}) — Balance: {formatPaise(acc.currentBalancePaise)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1.5">
                  2. Upload Statement File (.csv, .ofx, .qif) *
                </label>
                <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-blue-500/50 transition-colors">
                  <input
                    type="file"
                    accept=".csv,.ofx,.qif,.pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="statement-file-input"
                  />
                  <label htmlFor="statement-file-input" className="cursor-pointer space-y-2 block">
                    <UploadCloud className="w-10 h-10 mx-auto text-blue-500/70" />
                    <p className="text-sm font-semibold text-foreground">
                      {fileName ? fileName : "Click to select statement file"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Supports CSV, OFX, and QIF formats from HDFC, SBI, ICICI, Axis, Kotak, etc.
                    </p>
                  </label>
                </div>
              </div>

              {/* Offline Disclaimer Notice */}
              <div className="p-3 bg-muted/20 border border-border rounded-xl flex items-start gap-2.5 text-xs text-muted-foreground">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-foreground">100% Offline & Private</p>
                  <p className="text-[11px] mt-0.5">
                    Your statements are processed strictly on your device inside IndexedDB. No files, passwords, or transaction records are ever sent to an external server.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: CSV Column Mapping */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Confirm or adjust the column mapping detected from your CSV statement.
              </p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">Date Column *</label>
                  <select
                    value={customMapping.dateColIndex}
                    onChange={(e) =>
                      setCustomMapping({ ...customMapping, dateColIndex: parseInt(e.target.value, 10) })
                    }
                    className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground"
                  >
                    {csvHeaders.map((h, i) => (
                      <option key={i} value={i}>
                        {h} (Col {i + 1})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">Description / Narration *</label>
                  <select
                    value={customMapping.descriptionColIndex}
                    onChange={(e) =>
                      setCustomMapping({ ...customMapping, descriptionColIndex: parseInt(e.target.value, 10) })
                    }
                    className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground"
                  >
                    {csvHeaders.map((h, i) => (
                      <option key={i} value={i}>
                        {h} (Col {i + 1})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">Debit / Withdrawal</label>
                  <select
                    value={customMapping.debitColIndex ?? ""}
                    onChange={(e) =>
                      setCustomMapping({
                        ...customMapping,
                        debitColIndex: e.target.value !== "" ? parseInt(e.target.value, 10) : undefined,
                      })
                    }
                    className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground"
                  >
                    <option value="">-- None --</option>
                    {csvHeaders.map((h, i) => (
                      <option key={i} value={i}>
                        {h} (Col {i + 1})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">Credit / Deposit</label>
                  <select
                    value={customMapping.creditColIndex ?? ""}
                    onChange={(e) =>
                      setCustomMapping({
                        ...customMapping,
                        creditColIndex: e.target.value !== "" ? parseInt(e.target.value, 10) : undefined,
                      })
                    }
                    className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground"
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

              {/* CSV Sample Preview */}
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="bg-muted/40 px-3 py-2 text-[11px] font-semibold text-foreground border-b border-border">
                  Sample Data Preview
                </div>
                <div className="overflow-x-auto text-[11px]">
                  <table className="w-full text-left">
                    <thead className="bg-muted/20 border-b border-border text-muted-foreground">
                      <tr>
                        {csvHeaders.map((h, i) => (
                          <th key={i} className="px-3 py-1.5 whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvPreviewRows.map((row, rIdx) => (
                        <tr key={rIdx} className="border-b border-border/40">
                          {row.map((cell, cIdx) => (
                            <td key={cIdx} className="px-3 py-1.5 whitespace-nowrap text-foreground">
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
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-muted/20 border border-border rounded-xl text-xs">
                <div className="flex items-center gap-4">
                  <span>
                    Total Parsed: <strong>{previewResult.totalParsed}</strong>
                  </span>
                  <span className="text-emerald-400">
                    New Transactions: <strong>{previewResult.newCount}</strong>
                  </span>
                  <span className="text-amber-400">
                    Duplicates Detected: <strong>{previewResult.duplicateCount}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSelectAllNew}
                    className="px-2 py-1 text-[11px] rounded bg-muted hover:bg-muted/80 text-foreground cursor-pointer"
                  >
                    Select All New
                  </button>
                  <button
                    onClick={handleDeselectAll}
                    className="px-2 py-1 text-[11px] rounded bg-muted hover:bg-muted/80 text-foreground cursor-pointer"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              <div className="space-y-2 max-h-[48vh] overflow-y-auto">
                {previewItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleToggleSelectItem(item.id)}
                    className={`p-3 border rounded-xl flex items-center justify-between gap-3 text-xs cursor-pointer transition-colors ${
                      item.selectedForImport
                        ? "bg-card border-blue-500/50"
                        : "bg-muted/10 border-border/50 opacity-60"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={item.selectedForImport}
                        onChange={() => {}} // handled by parent div
                        className="rounded border-border text-blue-500 focus:ring-blue-500 cursor-pointer"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">{item.description}</span>
                          {item.status === "duplicate" ? (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 font-medium border border-amber-500/20">
                              Duplicate
                            </span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 font-medium border border-emerald-500/20">
                              New
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {item.occurredAt.split("T")[0]}
                          {item.matchExplanation ? ` • ${item.matchExplanation}` : ""}
                          {item.duplicateReason ? ` • ${item.duplicateReason}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`font-mono font-bold ${
                          item.direction === "inflow" ? "text-emerald-400" : "text-foreground"
                        }`}
                      >
                        {item.direction === "inflow" ? "+" : "-"} {formatPaise(item.amountPaise)}
                      </span>
                      {item.suggestedCategoryName && (
                        <p className="text-[10px] text-blue-400 mt-0.5">{item.suggestedCategoryName}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 4: Confirmation */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="p-4 bg-card border border-border rounded-xl space-y-3">
                <h3 className="text-sm font-bold text-foreground">Import Confirmation</h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-muted-foreground block">Destination Account:</span>
                    <span className="font-semibold text-foreground">{destinationAccount?.name}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Transactions to Import:</span>
                    <span className="font-semibold text-foreground">{selectedCount}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Duplicates Skipped:</span>
                    <span className="font-semibold text-amber-400">
                      {previewItems.length - selectedCount}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Ledger Integrity:</span>
                    <span className="font-semibold text-emerald-400">Atomic Unit-of-Work</span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-muted/20 border border-border rounded-xl text-xs text-muted-foreground">
                Committing this import will update account balances and record an audit log entry for transparency.
              </div>
            </div>
          )}

          {/* STEP 5: Success Summary */}
          {step === 5 && importSummary && (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-foreground">Import Completed Successfully!</h3>
                <p className="text-xs text-muted-foreground">
                  Your transactions have been recorded in the offline ledger.
                </p>
              </div>

              <div className="max-w-md mx-auto p-4 bg-card border border-border rounded-xl grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-muted-foreground block">Imported:</span>
                  <span className="font-mono font-bold text-base text-emerald-400">
                    {importSummary.importedCount}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Duplicates Skipped:</span>
                  <span className="font-mono font-bold text-base text-amber-400">
                    {importSummary.skippedCount}
                  </span>
                </div>
                <div className="col-span-2 pt-2 border-t border-border">
                  <span className="text-muted-foreground block">Account Updated Balance:</span>
                  <span className="font-mono font-bold text-base text-foreground">
                    {formatPaise(importSummary.destinationBalancePaise)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-card/50">
          {step === 1 && (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold rounded-lg border border-border text-muted-foreground hover:text-foreground cursor-pointer"
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
                disabled={!fileContent || !selectedAccountId}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-500 text-white hover:bg-blue-600 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <span>Continue</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2 text-xs font-semibold rounded-lg border border-border text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
              <button
                onClick={handleProceedToDeduplication}
                disabled={loading}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-500 text-white hover:bg-blue-600 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <span>Check Deduplication</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          {step === 3 && (
            <>
              <button
                onClick={() => setStep(fileType === "csv" ? 2 : 1)}
                className="px-4 py-2 text-xs font-semibold rounded-lg border border-border text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
              <button
                onClick={() => setStep(4)}
                disabled={selectedCount === 0}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-500 text-white hover:bg-blue-600 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <span>Review {selectedCount} Transactions</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          {step === 4 && (
            <>
              <button
                onClick={() => setStep(3)}
                className="px-4 py-2 text-xs font-semibold rounded-lg border border-border text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
              <button
                onClick={handleCommitImport}
                disabled={loading || selectedCount === 0}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-500 text-black hover:bg-emerald-400 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 font-bold"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{loading ? "Importing..." : "Confirm & Import to Ledger"}</span>
              </button>
            </>
          )}

          {step === 5 && (
            <div className="w-full flex justify-end">
              <button
                onClick={onClose}
                className="px-6 py-2 text-xs font-semibold rounded-lg bg-foreground text-background hover:opacity-90 cursor-pointer"
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

