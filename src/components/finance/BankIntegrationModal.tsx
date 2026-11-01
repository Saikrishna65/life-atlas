"use client";
import { FinancePanelHeader, useFinanceDialog } from "./FinanceDialog";

import React from "react";
import {
  X,
  Landmark,
  ShieldAlert,
  ShieldCheck,
  ExternalLink,
  CheckCircle2,
  Lock,
  Clock,
  ArrowRight,
} from "lucide-react";

interface BankIntegrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenImportModal: () => void;
}

export default function BankIntegrationModal({
  isOpen,
  onClose,
  onOpenImportModal,
}: BankIntegrationModalProps) {
  useFinanceDialog(isOpen, onClose);
  if (!isOpen) return null;

  return (
    <div className="finance-workspace-overlay">
      <div className="finance-workspace finance-tool-workspace" role="dialog" aria-modal="true" aria-label="Bank connections" tabIndex={-1}>
        <FinancePanelHeader title="Bank connections" subtitle="Choose how to bring your transactions into Atlas." onClose={onClose}/>

        <div className="finance-panel-content bank-connection-options">
          <article className="finance-connection-feature"><span className="finance-tool-symbol"><Landmark size={26}/></span><span className="finance-status-pill">AVAILABLE NOW</span><h3>Your bank history.<br/>One organised place.</h3><p>Import a statement from your bank to add past payments. You can review categories and duplicates before anything is saved.</p><div className="finance-file-types"><span>CSV</span><span>OFX</span><span>QIF</span></div></article>
          <article className="finance-connection-state"><div><Lock size={20}/><h3>Direct bank connection</h3></div><span className="finance-status-pill">NOT CONNECTED</span><p>Automatic bank sync is not configured. No bank login, password or OTP is needed to use statement import.</p></article>
          <div className="finance-inline-note"><ShieldCheck size={19}/><p>Statement files are processed on this device. Your account balances change only after you confirm the import.</p></div>
        </div>

        {/* Footer */}
        <div className="finance-panel-footer flex items-center justify-between px-6 py-4 border-t border-border bg-card/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg border border-border text-muted-foreground hover:text-foreground cursor-pointer"
          >
            Close
          </button>
          <button
            onClick={() => {
              onClose();
              onOpenImportModal();
            }}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-500 text-white hover:bg-blue-600 flex items-center gap-1.5 cursor-pointer font-bold"
          >
            <span>Import Statement File</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

