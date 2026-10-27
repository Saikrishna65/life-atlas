"use client";

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
  if (!isOpen) return null;

  const supportedInstitutions = [
    { name: "State Bank of India (SBI)", code: "SBI", type: "Public Bank", status: "Ready for AA consent" },
    { name: "HDFC Bank", code: "HDFC", type: "Private Bank", status: "Ready for AA consent" },
    { name: "ICICI Bank", code: "ICICI", type: "Private Bank", status: "Ready for AA consent" },
    { name: "Axis Bank", code: "AXIS", type: "Private Bank", status: "Ready for AA consent" },
    { name: "Kotak Mahindra Bank", code: "KOTAK", type: "Private Bank", status: "Ready for AA consent" },
    { name: "IndusInd Bank", code: "INDUSIND", type: "Private Bank", status: "Ready for AA consent" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-xl max-h-[90vh] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Bank Sync & Account Aggregator</h2>
              <p className="text-xs text-muted-foreground">RBI-regulated consent framework architecture</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          {/* Honest Disclosure Box */}
          <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl space-y-2 text-foreground">
            <div className="flex items-center gap-2 font-bold text-blue-400">
              <ShieldCheck className="w-4 h-4" />
              <span>Honest Security & Regulatory Compliance</span>
            </div>
            <p className="leading-relaxed text-muted-foreground">
              Life Atlas adheres strictly to Reserve Bank of India (RBI) cybersecurity guidelines. We <strong>never scrape bank websites</strong>, <strong>never capture SMS notifications</strong> without explicit intent, and <strong>never request your net banking password or OTPs</strong>.
            </p>
          </div>

          {/* Connection Status Card */}
          <div className="p-4 bg-card border border-border rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground">Current Integration Status</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                NOT_CONNECTED (Phase 4 Ready)
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/50 text-[11px]">
              <div>
                <span className="text-muted-foreground block">Consent Gateway:</span>
                <span className="font-semibold text-foreground">RBI NBFC-AA Protocol</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Encryption Standard:</span>
                <span className="font-semibold text-foreground">End-to-End Elliptic Curve</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Session Status:</span>
                <span className="font-semibold text-foreground">Idle (No active consent)</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Recommended Action:</span>
                <span className="font-semibold text-emerald-400">Offline Statement Import</span>
              </div>
            </div>
          </div>

          {/* How Account Aggregator Works */}
          <div className="space-y-2">
            <h4 className="font-bold text-foreground">How RBI Account Aggregator Works</h4>
            <div className="space-y-1.5 text-muted-foreground leading-relaxed">
              <div className="flex items-start gap-2">
                <div className="w-4 h-4 rounded-full bg-muted flex items-center justify-center text-[10px] text-foreground font-bold shrink-0 mt-0.5">
                  1
                </div>
                <span>You initiate consent with an RBI-licensed AA provider (e.g. Setu, Finvu, OneMoney).</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-4 h-4 rounded-full bg-muted flex items-center justify-center text-[10px] text-foreground font-bold shrink-0 mt-0.5">
                  2
                </div>
                <span>Your bank (FIP) encrypts statements directly for Life Atlas using public-key cryptography.</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-4 h-4 rounded-full bg-muted flex items-center justify-center text-[10px] text-foreground font-bold shrink-0 mt-0.5">
                  3
                </div>
                <span>Consent is revocable at any time from your AA dashboard.</span>
              </div>
            </div>
          </div>

          {/* Prepared Bank Institutions */}
          <div className="space-y-2">
            <h4 className="font-bold text-foreground">Supported Financial Institutions (Prepared)</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {supportedInstitutions.map((inst) => (
                <div
                  key={inst.code}
                  className="p-2.5 bg-muted/20 border border-border/60 rounded-lg flex items-center justify-between"
                >
                  <div>
                    <span className="font-semibold text-foreground block">{inst.name}</span>
                    <span className="text-[10px] text-muted-foreground">{inst.type}</span>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-medium">Ready</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-card/50">
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

