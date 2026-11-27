"use client";
import { useEffect, useState } from "react";
import { balances, type SharedGroup } from "@/lib/finance/shared/domain";
import { loadSharedOptions } from "@/lib/finance/shared/options";
import type { RepaymentSelection } from "@/lib/finance/shared/repayment";
import FinanceSelect from "../FinanceSelect";
export default function RepaymentMatch({
  value,
  onChange,
  amountPaise,
  currency = "INR",
  eligible = true,
  disabled = false,
  transactionId,
}: {
  value?: RepaymentSelection | null;
  onChange: (value: RepaymentSelection | null) => void;
  amountPaise: number;
  currency?: string;
  eligible?: boolean;
  disabled?: boolean;
  transactionId?: string;
}) {
  const [groups, setGroups] = useState<SharedGroup[]>([]),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    if (eligible)
      void loadSharedOptions()
        .then((rows) => {
          if (active) {
            setGroups(rows);
            setLoaded(true);
          }
        })
        .catch(() => {
          if (active)
            setError(
              "Could not open group balances. Reopen this form to retry.",
            );
        });
    return () => {
      active = false;
    };
  }, [eligible]);
  if (!eligible) return null;
  const money = (amount: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(
      amount / 100,
    );
  const available = groups.filter((g) => g.currency === currency),
    group = available.find((g) => g.id === value?.groupId);
  const member = group?.members.find((m) => m.id === value?.memberId);
  const current = group?.settlements.find(
    (s) => s.sourceTransactionId === transactionId && !s.voidedAt,
  );
  const b = group
    ? balances({
        ...group,
        settlements: group.settlements.filter((s) => s.id !== current?.id),
      })
    : {};
  const owed =
    group && member
      ? Math.max(0, Math.min(-(b[member.id] || 0), b[group.selfId] || 0))
      : 0;
  const candidates =
    group?.settlements.filter(
      (s) =>
        !s.voidedAt &&
        !s.sourceTransactionId &&
        s.fromId === member?.id &&
        s.toId === group.selfId &&
        s.amountPaise === amountPaise,
    ) || [];
  const key = value ? JSON.stringify([value.groupId, value.memberId]) : "";
  return (
    <div
      className="finance-repayment-match"
      style={{ gridColumn: "1 / -1", padding: "14px 0" }}
    >
      <label style={{ display: "block" }}>
        Money from your roommate?
        <FinanceSelect
          aria-label="Match repayment"
          value={key}
          disabled={disabled || !loaded || !!error}
          onChange={(e) => {
            if (!e.target.value) onChange(null);
            else {
              const [groupId, memberId] = JSON.parse(e.target.value) as [
                string,
                string,
              ];
              onChange({ groupId, memberId });
            }
          }}
        >
          <option value="">No repayment match</option>
          {value && !member && (
            <option value={key}>Previous match · check availability</option>
          )}
          {available.flatMap((g) => {
            const balance = balances(g);
            return g.members
              .filter((m) => m.id !== g.selfId)
              .map((m) => (
                <option
                  key={`${g.id}:${m.id}`}
                  value={JSON.stringify([g.id, m.id])}
                >
                  {g.title} · {m.name} · owes{" "}
                  {money(Math.max(0, -balance[m.id]))}
                </option>
              ));
          })}
        </FinanceSelect>
      </label>
      {error && <p role="alert">{error}</p>}
      {!value && (
        <p style={{ fontSize: 12 }}>
          Optional · confirm who repaid you. Atlas won’t guess from a bank name.
        </p>
      )}
      {group && member && value && (
        <div style={{ fontSize: 12, lineHeight: 1.8 }} role="status">
          <p>
            {money(amountPaise)} received from {member.name}. This reduces their
            group balance and counts as a reimbursement, not earnings.
          </p>
          {candidates.length > 0 && !current && (
            <label>
              Already recorded this payment?
              <FinanceSelect
                aria-label="Recorded repayment"
                disabled={disabled}
                value={value.settlementId || ""}
                onChange={(e) =>
                  onChange({
                    ...value,
                    settlementId: e.target.value || undefined,
                  })
                }
              >
                <option value="">Create a linked repayment</option>
                {candidates.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.date} · {money(s.amountPaise)} ·{" "}
                    {s.note || "Recorded payment"}
                  </option>
                ))}
              </FinanceSelect>
              <small>
                Link the existing payment to avoid settling it twice.
              </small>
            </label>
          )}
          {!value.settlementId &&
            amountPaise > owed &&
            !(
              current &&
              current.fromId === member.id &&
              amountPaise <= current.amountPaise
            ) && (
              <label
                style={{ display: "flex", gap: 8, alignItems: "flex-start" }}
              >
                <input
                  type="checkbox"
                  aria-label="Confirm actual overpayment"
                  checked={!!value.allowOverpayment}
                  disabled={disabled}
                  onChange={(e) =>
                    onChange({ ...value, allowOverpayment: e.target.checked })
                  }
                />
                This exceeds the {money(owed)} currently owed. I confirm the
                extra money is also a group repayment and should become a
                credit.
              </label>
            )}
          <p>
            Editing or reversing this bank payment updates its linked
            settlement. No money is moved by Atlas.
          </p>
        </div>
      )}
    </div>
  );
}
