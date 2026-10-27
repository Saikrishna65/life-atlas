"use client";

import React, { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Landmark, Wallet, CreditCard, PiggyBank, Plus, Check } from "lucide-react";
import {
  FinanceAccount,
  AccountType,
  AccountService,
  rupeesToPaise,
  paiseToDecimalString,
} from "@/lib/finance";

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  accountService: AccountService;
  editingAccount?: FinanceAccount | null;
}

const ACCOUNT_TYPES: { type: AccountType; label: string; icon: React.ElementType; description: string }[] = [
  { type: "bank", label: "Bank Account", icon: Landmark, description: "Checking or salary account" },
  { type: "cash", label: "Cash / Wallet", icon: Wallet, description: "Physical cash in hand" },
  { type: "savings", label: "Savings Account", icon: PiggyBank, description: "Interest-earning deposits" },
  { type: "credit", label: "Credit Card (Debt)", icon: CreditCard, description: "Liability / credit line" },
];

export default function AccountModal({
  isOpen,
  onClose,
  onSuccess,
  accountService,
  editingAccount,
}: AccountModalProps) {
  const [name, setName] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("bank");
  const [openingBalanceStr, setOpeningBalanceStr] = useState("0");
  const [institutionName, setInstitutionName] = useState("");
  const [accountNumberLast4, setAccountNumberLast4] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editingAccount) {
      setName(editingAccount.name);
      setAccountType(editingAccount.accountType);
      setOpeningBalanceStr(paiseToDecimalString(editingAccount.openingBalancePaise));
      setInstitutionName(editingAccount.metadata?.institutionName || "");
      setAccountNumberLast4(editingAccount.metadata?.accountNumberLast4 || "");
    } else {
      setName("");
      setAccountType("bank");
      setOpeningBalanceStr("0");
      setInstitutionName("");
      setAccountNumberLast4("");
    }
    setErrorMessage(null);
  }, [editingAccount, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage("Please enter an account name.");
      return;
    }

    let balancePaise = 0;
    try {
      balancePaise = rupeesToPaise(openingBalanceStr || "0");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Invalid balance amount";
      setErrorMessage(msg);
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingAccount) {
        await accountService.updateAccount(editingAccount.id, {
          name: name.trim(),
          metadata: {
            institutionName: institutionName.trim() || undefined,
            accountNumberLast4: accountNumberLast4.trim() || undefined,
          },
        });
      } else {
        await accountService.createAccount({
          name: name.trim(),
          accountType,
          openingBalancePaise: balancePaise,
          currency: "INR",
          metadata: {
            institutionName: institutionName.trim() || undefined,
            accountNumberLast4: accountNumberLast4.trim() || undefined,
          },
        });
      }
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save account";
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingAccount ? "Edit Account" : "Add Financial Account"}
      subtitle="Manual local tracking with zero bank credentials stored."
      maxWidthClassName="max-w-md"
    >
      <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
        {errorMessage && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
            {errorMessage}
          </div>
        )}

        {/* Account Type Selector (only on create) */}
        {!editingAccount && (
          <div className="space-y-1.5">
            <label className="text-xs font-sans font-medium text-muted-foreground uppercase tracking-wider block">
              Account Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {ACCOUNT_TYPES.map((t) => {
                const Icon = t.icon;
                const isSelected = accountType === t.type;
                return (
                  <button
                    key={t.type}
                    type="button"
                    onClick={() => setAccountType(t.type)}
                    className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/30"
                        : "border-muted bg-surface/50 text-muted-foreground hover:border-foreground/20"
                    }`}
                  >
                    <Icon className="w-4 h-4 mb-1.5" />
                    <span className="text-xs font-semibold text-foreground">{t.label}</span>
                    <span className="text-[10px] text-muted-foreground line-clamp-1">{t.description}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Name Input */}
        <div className="space-y-1">
          <label className="text-xs font-sans font-medium text-muted-foreground">Account Name</label>
          <input
            type="text"
            required
            placeholder="e.g. HDFC Salary Account, Emergency Fund"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-surface border border-muted text-xs text-foreground focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Opening Balance (only on create) */}
        {!editingAccount && (
          <div className="space-y-1">
            <label className="text-xs font-sans font-medium text-muted-foreground">
              Opening Balance (₹ INR)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs text-muted-foreground font-mono">₹</span>
              <input
                type="text"
                placeholder="0.00"
                value={openingBalanceStr}
                onChange={(e) => setOpeningBalanceStr(e.target.value)}
                className="w-full pl-7 pr-3 py-2 rounded-lg bg-surface border border-muted text-xs font-mono text-foreground focus:outline-none focus:border-emerald-500"
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              {accountType === "credit"
                ? "For credit cards, positive amount represents current debt owed."
                : "Initial funds on the day you start tracking."}
            </p>
          </div>
        )}

        {/* Optional Metadata */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="space-y-1">
            <label className="text-[11px] font-sans font-medium text-muted-foreground">Institution (Optional)</label>
            <input
              type="text"
              placeholder="e.g. SBI, ICICI"
              value={institutionName}
              onChange={(e) => setInstitutionName(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-surface border border-muted text-xs text-foreground focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-sans font-medium text-muted-foreground">Last 4 Digits (Optional)</label>
            <input
              type="text"
              maxLength={4}
              placeholder="e.g. 4092"
              value={accountNumberLast4}
              onChange={(e) => setAccountNumberLast4(e.target.value.replace(/\D/g, ""))}
              className="w-full px-3 py-1.5 rounded-lg bg-surface border border-muted text-xs font-mono text-foreground focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-4 border-t border-muted">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg border border-muted text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-500 text-black text-xs font-semibold hover:bg-emerald-400 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {editingAccount ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            <span>{editingAccount ? "Save Changes" : "Create Account"}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}

