"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { loadSharedOptions } from "@/lib/finance/shared/options";
import { allocate, type SharedGroup } from "@/lib/finance/shared/domain";
import type { TransactionSplit } from "@/lib/finance/shared/transactionSplit";
import FinanceSelect from "../FinanceSelect";

export default function SplitWith({
  value,
  onChange,
  amountPaise,
  currency = "INR",
  eligible = true,
  disabled = false,
}: {
  value?: TransactionSplit | null;
  onChange: (split: TransactionSplit | null) => void;
  amountPaise: number;
  currency?: string;
  eligible?: boolean;
  disabled?: boolean;
}) {
  const [groups, setGroups] = useState<SharedGroup[]>([]),
    [error, setError] = useState(""),
    [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let active = true;
    void loadSharedOptions()
      .then((rows) => {
        if (active) {
          setGroups(rows);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (active) {
          setError(
            "Could not open shared groups. Reopen this form to try again.",
          );
          setLoaded(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);
  const available = groups.filter((g) => g.currency === currency),
    group = available.find((g) => g.id === value?.groupId);
  const split =
    group && value && amountPaise > 0 && Number.isSafeInteger(amountPaise)
      ? allocate(amountPaise, value.memberIds, "equal")
      : [];
  return (
    <div
      className="finance-split-with"
      style={{ gridColumn: "1 / -1", padding: "14px 0" }}
    >
      <label style={{ display: "block", marginBottom: 8 }}>
        Split with
        <FinanceSelect
          aria-label="Split with"
          value={value?.groupId || ""}
          disabled={disabled || !eligible || !loaded || !!error}
          onChange={(e) => {
            const next = available.find((g) => g.id === e.target.value);
            onChange(
              next
                ? { groupId: next.id, memberIds: next.members.map((m) => m.id) }
                : null,
            );
          }}
        >
          <option value="">Just me</option>
          {value && !group && (
            <option value={value.groupId}>
              Previously selected group · check availability
            </option>
          )}
          {available.map((g) => (
            <option key={g.id} value={g.id}>
              {g.title} ·{" "}
              {g.members
                .filter((m) => m.id !== g.selfId)
                .map((m) => m.name)
                .join(", ")}
            </option>
          ))}
        </FinanceSelect>
      </label>
      {!eligible ? (
        <p style={{ fontSize: 12 }}>
          Only posted expenses can be split. Income, refunds and transfers stay
          separate.
        </p>
      ) : error ? (
        <p role="alert">{error}</p>
      ) : group && value ? (
        <div role="status" style={{ fontSize: 12, lineHeight: 1.8 }}>
          <p>You paid the full amount. Split equally:</p>
          {split.map((s) => (
            <span key={s.memberId} style={{ display: "block" }}>
              {group.members.find((m) => m.id === s.memberId)?.name ||
                "Person no longer in group"}{" "}
              ·{" "}
              {new Intl.NumberFormat("en-IN", {
                style: "currency",
                currency,
              }).format(s.amountPaise / 100)}
            </span>
          ))}
          <p>Linked to this payment. No second bank expense is created.</p>
        </div>
      ) : (
        <p style={{ fontSize: 12 }}>
          Optional · choose your room or another shared group.
          {loaded && !available.length && (
            <>
              {" "}
              <Link href="/secret/finance/shared">
                Create a shared group first
              </Link>
              .
            </>
          )}
        </p>
      )}
    </div>
  );
}
