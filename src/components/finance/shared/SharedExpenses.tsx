"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Users,
  ArrowRight,
  Copy,
  Check,
  Pencil,
  Undo2,
} from "lucide-react";
import { Modal } from "../FinanceDialog";
import {
  allocate,
  balances,
  checkSettlement,
  suggestions,
  type SharedGroup,
  type SharedExpense,
  type SplitMode,
} from "@/lib/finance/shared/domain";
import {
  listSharedGroups,
  saveSharedGroup,
} from "@/lib/finance/shared/service";
import { rupeesToPaise } from "@/lib/finance/domain/money";
import { useGalleryBack } from "@/lib/gallery/navigation";
import { localFinanceDateKey } from "@/lib/finance/calendar";
import { getAllTrips } from "@/lib/vault/storage";
import "@/app/secret/finance/finance.css";
import "./shared.css";

const today = () => localFinanceDateKey(new Date());
const money = (value: number, currency: string) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(
    value / 100,
  );
const errorText = (error: unknown) =>
  error instanceof Error ? error.message : "Could not save. Try again.";
type Form =
  | { kind: "group" }
  | { kind: "expense"; group: SharedGroup; expense?: SharedExpense }
  | {
      kind: "payment";
      group: SharedGroup;
      fromId?: string;
      toId?: string;
      amountPaise?: number;
    }
  | { kind: "people"; group: SharedGroup }
  | {
      kind: "void";
      group: SharedGroup;
      id: string;
      record: "expense" | "payment";
    };

export default function SharedExpenses() {
  const [groups, setGroups] = useState<SharedGroup[]>([]),
    [selected, setSelected] = useState<string | null>(null);
  const [form, setForm] = useState<Form | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [visibleHistory, setVisibleHistory] = useState(50);
  const refreshSequence = useRef(0);
  const refresh = useCallback(async () => {
    const sequence = ++refreshSequence.current;
    try {
      const records = await listSharedGroups();
      if (sequence !== refreshSequence.current) return;
      setGroups(records);
      setError("");
    } catch (e) {
      if (sequence === refreshSequence.current) setError(errorText(e));
    } finally {
      if (sequence === refreshSequence.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    const initial = setTimeout(() => {
      void refresh();
    }, 0);
    let channel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== "undefined")
        channel = new BroadcastChannel("atlas-shared-expenses");
    } catch {
      /* Optional in restricted browser contexts. */
    }
    const changed = () => {
      void refresh();
    };
    const visible = () => {
      if (!document.hidden) changed();
    };
    channel?.addEventListener("message", changed);
    window.addEventListener("finance-shared-updated", changed);
    document.addEventListener("visibilitychange", visible);
    return () => {
      ++refreshSequence.current;
      clearTimeout(initial);
      channel?.close();
      window.removeEventListener("finance-shared-updated", changed);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [refresh]);
  const group = groups.find((g) => g.id === selected),
    b = group ? balances(group) : {},
    payments = group ? suggestions(group) : [];
  const history = useMemo(
    () =>
      group
        ? [
            ...group.expenses.map((e) => ({ ...e, type: "expense" as const })),
            ...group.settlements.map((s) => ({
              ...s,
              type: "payment" as const,
            })),
          ].sort(
            (a, b) =>
              b.date.localeCompare(a.date) ||
              b.createdAt.localeCompare(a.createdAt),
          )
        : [],
    [group],
  );
  const name = (id: string) =>
    group?.members.find((m) => m.id === id)?.name || "Unknown person";
  async function copied() {
    if (!group) return;
    try {
      await navigator.clipboard.writeText(
        [
          group.title,
          ...group.members.map(
            (m) =>
              `${m.name}: ${b[m.id] < 0 ? "owes" : "is owed"} ${money(Math.abs(b[m.id]), group.currency)}`,
          ),
          ...payments.map(
            (p) =>
              `${name(p.fromId)} → ${name(p.toId)}: ${money(p.amountPaise, group.currency)}`,
          ),
        ].join("\n"),
      );
      setNotice("Summary copied.");
    } catch {
      setNotice("Copy is unavailable. You can read the balances below.");
    }
  }
  const finished = async (saved: SharedGroup) => {
    ++refreshSequence.current;
    setGroups((current) => [
      saved,
      ...current.filter((g) => g.id !== saved.id),
    ]);
    setSelected(saved.id);
    setForm(null);
    setNotice("Saved on this device.");
    await refresh();
  };
  return (
    <main className="atlas-finance shared-page">
      <header className="shared-header">
        <Link href="/secret/finance" className="shared-back">
          <ArrowLeft size={20} />
          Finance
        </Link>
        <button
          className="af-primary"
          onClick={() => setForm({ kind: "group" })}
        >
          <Plus size={18} />
          New group
        </button>
      </header>
      <div className="shared-intro">
        <span className="af-eyebrow">SPLIT IT. SETTLE IT.</span>
        <h1>
          Good company.
          <br />
          Clear balances.
        </h1>
        <p>Keep track of shared costs, without the awkward maths.</p>
      </div>
      {error && (
        <div role="alert" className="shared-error">
          {error}
          <button onClick={() => void refresh()}>Try again</button>
        </div>
      )}
      {notice && (
        <p role="status" className="shared-notice">
          {notice}
        </p>
      )}
      <div className="shared-layout">
        <aside aria-label="Your groups" className="shared-groups">
          <h2>Your groups</h2>
          {loading ? (
            <p role="status">Opening your groups…</p>
          ) : !groups.length ? (
            <div className="shared-empty">
              <Users />
              <h3>Start with your people</h3>
              <p>A weekend away, flatmates or just dinner.</p>
              <button
                className="af-primary"
                onClick={() => setForm({ kind: "group" })}
              >
                Create a group
              </button>
            </div>
          ) : (
            groups.map((g) => {
              const balance = balances(g)[g.selfId];
              return (
                <button
                  className={`shared-group ${selected === g.id ? "is-selected" : ""}`}
                  aria-pressed={selected === g.id}
                  key={g.id}
                  onClick={() => {
                    setSelected(g.id);
                    setVisibleHistory(50);
                    setNotice("");
                  }}
                >
                  <strong>{g.title}</strong>
                  <span>
                    {g.members.length} people · {g.currency}
                  </span>
                  <b>
                    {balance === 0
                      ? "You’re settled up"
                      : `You ${balance > 0 ? "get back" : "owe"} ${money(Math.abs(balance), g.currency)}`}
                  </b>
                  {g.tripTitle && <small>{g.tripTitle}</small>}
                </button>
              );
            })
          )}
        </aside>
        <section className="shared-detail" aria-label="Group details">
          {!group ? (
            <div className="shared-placeholder">
              <Users size={42} />
              <h2>A little less “who paid?”</h2>
              <p>Choose a group to see expenses and settle up.</p>
            </div>
          ) : (
            <>
              <div className="shared-title">
                <div>
                  <span className="af-eyebrow">
                    {group.tripTitle || "YOUR SHARED LEDGER"}
                  </span>
                  <h2>{group.title}</h2>
                  <p>{group.members.map((m) => m.name).join(" · ")}</p>
                </div>
                <button
                  className="shared-icon"
                  aria-label="Manage people"
                  onClick={() => setForm({ kind: "people", group })}
                >
                  <Pencil size={18} />
                </button>
              </div>
              <div className="shared-balances">
                {group.members.map((m) => (
                  <div key={m.id}>
                    <span>
                      {m.name}
                      {m.id === group.selfId && m.name.toLowerCase() !== "you"
                        ? " (you)"
                        : ""}
                    </span>
                    <strong className={b[m.id] > 0 ? "positive" : ""}>
                      {money(Math.abs(b[m.id]), group.currency)}
                    </strong>
                    <small>
                      {b[m.id] === 0
                        ? "Settled up"
                        : b[m.id] > 0
                          ? "Gets back"
                          : "Owes"}
                    </small>
                  </div>
                ))}
              </div>
              <div className="shared-actions">
                <button
                  className="af-primary"
                  onClick={() => setForm({ kind: "expense", group })}
                >
                  <Plus size={17} />
                  Add expense
                </button>
                <button
                  className="shared-secondary"
                  onClick={() =>
                    setForm({ kind: "payment", group, ...payments[0] })
                  }
                >
                  Record payment
                </button>
                <button
                  className="shared-secondary"
                  onClick={() => void copied()}
                >
                  <Copy size={16} />
                  Copy summary
                </button>
              </div>
              <p className="shared-explainer">
                This tracks what people owe. It doesn’t move money or add bank
                transactions. Keep your actual bank payments in Finance; don’t
                enter them twice.
              </p>
              <section className="shared-suggestions">
                <h3>Settle up</h3>
                {!payments.length ? (
                  <p className="shared-settled">
                    <Check size={18} />
                    Everyone is settled up.
                  </p>
                ) : (
                  <>
                    <p>
                      Suggested payments simplify the group’s balances. Record
                      only money that has actually changed hands.
                    </p>
                    {payments.map((p) => (
                      <div
                        className="shared-payment"
                        key={`${p.fromId}-${p.toId}`}
                      >
                        <span>
                          {name(p.fromId)}
                          <ArrowRight size={16} />
                          {name(p.toId)}
                        </span>
                        <strong>{money(p.amountPaise, group.currency)}</strong>
                        <button
                          onClick={() =>
                            setForm({ kind: "payment", group, ...p })
                          }
                        >
                          Record
                        </button>
                      </div>
                    ))}
                  </>
                )}
              </section>
              <section className="shared-history">
                <h3>Expenses & payments</h3>
                {!group.expenses.length && !group.settlements.length && (
                  <p>
                    No shared expenses yet. Add the first bill when you’re
                    ready.
                  </p>
                )}
                {history.slice(0, visibleHistory).map((record) => (
                  <article
                    className={`shared-record ${record.voidedAt ? "is-void" : ""}`}
                    key={record.id}
                  >
                    <div>
                      <strong>
                        {record.type === "expense"
                          ? record.title
                          : `${name(record.fromId)} paid ${name(record.toId)}`}
                      </strong>
                      <p>
                        {record.date}
                        {record.type === "expense"
                          ? ` · Paid by ${name(record.payerId)} · ${record.splitMode} split`
                          : record.note
                            ? ` · ${record.note}`
                            : " · Repayment"}
                      </p>
                      {record.type === "expense" && (
                        <details>
                          <summary>See split</summary>
                          <ul>
                            {record.shares.map((s) => (
                              <li key={s.memberId}>
                                {name(s.memberId)}{" "}
                                <b>{money(s.amountPaise, group.currency)}</b>
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                      {record.type === "expense" && record.sourceTransactionId && <small>From a bank payment · <Link href="/secret/finance">edit its amount or split in Atlas Finance</Link></small>}
                      {record.voidedAt && (
                        <small>Cancelled · kept in history</small>
                      )}
                    </div>
                    <div className="shared-record-end">
                      <b>{money(record.amountPaise, group.currency)}</b>
                      {!record.voidedAt && !(record.type === "expense" && record.sourceTransactionId) && (
                        <div>
                          {record.type === "expense" && (
                            <button
                              aria-label={`Edit ${record.title}`}
                              onClick={() =>
                                setForm({
                                  kind: "expense",
                                  group,
                                  expense: record,
                                })
                              }
                            >
                              <Pencil size={15} />
                            </button>
                          )}
                          <button
                            aria-label={`Cancel ${record.type === "expense" ? record.title : "payment"}`}
                            onClick={() =>
                              setForm({
                                kind: "void",
                                group,
                                id: record.id,
                                record: record.type,
                              })
                            }
                          >
                            <Undo2 size={15} />
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                ))}
                {history.length > visibleHistory && (
                  <button
                    className="shared-secondary"
                    onClick={() => setVisibleHistory((value) => value + 50)}
                  >
                    Show next {Math.min(50, history.length - visibleHistory)}{" "}
                    records
                  </button>
                )}
              </section>
            </>
          )}
        </section>
      </div>
      <footer className="shared-footer">
        Private, local records. Included in your encrypted Finance backups. Each
        group keeps its own currency.
      </footer>
      {form && (
        <SharedForm
          key={form.kind + ("id" in form ? form.id : "")}
          form={form}
          close={() => setForm(null)}
          finished={finished}
        />
      )}
    </main>
  );
}

function SharedForm({
  form,
  close,
  finished,
}: {
  form: Form;
  close: () => void;
  finished: (g: SharedGroup) => Promise<void>;
}) {
  const group = "group" in form ? form.group : undefined,
    existing = form.kind === "expense" ? form.expense : undefined;
  const [title, setTitle] = useState(existing?.title || ""),
    [currency, setCurrency] = useState("INR"),
    [names, setNames] = useState(""),
    [trips, setTrips] = useState<{ id: string; title: string }[]>([]),
    [tripId, setTripId] = useState("");
  const [memberNames, setMemberNames] = useState<Record<string, string>>(
    Object.fromEntries(group?.members.map((m) => [m.id, m.name]) || []),
  );
  const [total, setTotal] = useState(
    existing
      ? (existing.amountPaise / 100).toFixed(2)
      : form.kind === "payment" && form.amountPaise
        ? (form.amountPaise / 100).toFixed(2)
        : "",
  );
  const [payer, setPayer] = useState(
      existing?.payerId ||
        (form.kind === "payment" ? form.fromId : "") ||
        group?.selfId ||
        "",
    ),
    [recipient, setRecipient] = useState(
      form.kind === "payment"
        ? form.toId || group?.members.find((m) => m.id !== payer)?.id || ""
        : "",
    );
  const [mode, setMode] = useState<SplitMode>(existing?.splitMode || "equal"),
    [participants, setParticipants] = useState(
      existing?.shares.map((s) => s.memberId) ||
        group?.members.map((m) => m.id) ||
        [],
    );
  const [weights, setWeights] = useState<Record<string, string>>(
    Object.fromEntries(
      existing?.shares.map((s, i) => [
        s.memberId,
        ((existing.weights[i] || 0) / 100).toFixed(2),
      ]) || [],
    ),
  );
  const [date, setDate] = useState(existing?.date || today()),
    [note, setNote] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [overpay, setOverpay] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useGalleryBack(
    true,
    () => {
      if (!busy) close();
    },
    60,
  );
  useEffect(() => {
    if (form.kind === "group")
      void getAllTrips()
        .then((rows) =>
          setTrips(rows.map((t) => ({ id: t.id, title: t.title }))),
        )
        .catch(() => {});
  }, [form.kind]);
  const preview = useMemo(() => {
    if (form.kind !== "expense") return null;
    try {
      return {
        shares: allocate(
          rupeesToPaise(total),
          participants,
          mode,
          mode === "equal"
            ? []
            : participants.map((id) => rupeesToPaise(weights[id] || "0")),
        ),
        error: "",
      };
    } catch (e) {
      return { shares: [], error: errorText(e) };
    }
  }, [form.kind, total, participants, mode, weights]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const now = new Date().toISOString();
      let saved: SharedGroup;
      if (form.kind === "group") {
        const others = names
          .split("\n")
          .map((v) => v.trim())
          .filter(Boolean);
        if (
          new Set(["you", ...others.map((v) => v.toLowerCase())]).size !==
          others.length + 1
        )
          throw new Error(
            "Use different names so everyone is easy to identify.",
          );
        const id = crypto.randomUUID(),
          selfId = crypto.randomUUID(),
          trip = trips.find((t) => t.id === tripId);
        saved = await saveSharedGroup(id, 0, () => ({
          schemaVersion: 1,
          id,
          title: title.trim(),
          currency,
          selfId,
          members: [
            { id: selfId, name: "You" },
            ...others.map((name) => ({ id: crypto.randomUUID(), name })),
          ],
          ...(trip ? { tripId: trip.id, tripTitle: trip.title } : {}),
          expenses: [],
          settlements: [],
          createdAt: now,
          updatedAt: now,
          version: 1,
        }));
      } else {
        saved = await saveSharedGroup(
          form.group.id,
          form.group.version,
          (current) => {
            if (!current) throw new Error("This group is no longer available.");
            if (form.kind === "expense") {
              const amountPaise = rupeesToPaise(total),
                splitWeights =
                  mode === "equal"
                    ? []
                    : participants.map((id) =>
                        rupeesToPaise(weights[id] || "0"),
                      );
              const expense: SharedExpense = {
                id: existing?.id || crypto.randomUUID(),
                title: title.trim(),
                payerId: payer,
                amountPaise,
                splitMode: mode,
                weights: splitWeights,
                shares: allocate(amountPaise, participants, mode, splitWeights),
                date,
                createdAt: existing?.createdAt || now,
              };
              if (existing)
                current.expenses = current.expenses.map((e) =>
                  e.id === existing.id ? expense : e,
                );
              else current.expenses.push(expense);
            } else if (form.kind === "payment") {
              const payment = {
                id: crypto.randomUUID(),
                fromId: payer,
                toId: recipient,
                amountPaise: rupeesToPaise(total),
                date,
                note: note.trim(),
                createdAt: now,
              };
              checkSettlement(current, payment, confirmed, overpay);
              current.settlements.push(payment);
            } else if (form.kind === "void") {
              const record = (
                form.record === "expense"
                  ? current.expenses
                  : current.settlements
              ).find((r) => r.id === form.id);
              if (!record || record.voidedAt)
                throw new Error("This record has already changed.");
              record.voidedAt = now;
            } else {
              current.members = current.members.map((m) => ({
                ...m,
                name: (memberNames[m.id] || "").trim(),
              }));
              for (const name of names
                .split("\n")
                .map((v) => v.trim())
                .filter(Boolean))
                current.members.push({ id: crypto.randomUUID(), name });
              if (
                new Set(current.members.map((m) => m.name.toLowerCase()))
                  .size !== current.members.length
              )
                throw new Error("Give each person a different name.");
            }
            return current;
          },
          form.kind === "void",
        );
      }
      await finished(saved);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  const label =
    form.kind === "group"
      ? "New shared group"
      : form.kind === "expense"
        ? existing
          ? "Edit expense"
          : "Add expense"
        : form.kind === "payment"
          ? "Record a payment"
          : form.kind === "people"
            ? "Your people"
            : "Cancel this record?";
  const personSelect = (
    label: string,
    value: string,
    change: (value: string) => void,
  ) => (
    <label>
      {label}
      <select value={value} onChange={(e) => change(e.target.value)}>
        {group?.members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <Modal
      isOpen
      onClose={() => {
        if (!busy) close();
      }}
      title={label}
      subtitle={group?.title}
    >
      <form className="shared-form" onSubmit={submit}>
        {form.kind === "group" && (
          <>
            <label>
              Group name
              <input
                autoFocus
                required
                maxLength={120}
                placeholder="A weekend in the hills"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label>
              Other people{" "}
              <small>One name per line. You’re included automatically.</small>
              <textarea
                required
                rows={3}
                placeholder={"Aarav\nMaya"}
                value={names}
                onChange={(e) => setNames(e.target.value)}
              />
            </label>
            <label>
              Currency
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                {["INR", "USD", "EUR", "GBP"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <small>Stays the same for every expense in this group.</small>
            </label>
            {trips.length > 0 && (
              <label>
                Link to a trip <small>Optional · stays private</small>
                <select
                  value={tripId}
                  onChange={(e) => setTripId(e.target.value)}
                >
                  <option value="">No trip</option>
                  {trips.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </>
        )}
        {form.kind === "people" && (
          <>
            {group?.members.map((m) => (
              <label key={m.id}>
                {m.id === group.selfId ? "Your name" : "Name"}
                <input
                  required
                  maxLength={80}
                  value={memberNames[m.id]}
                  onChange={(e) =>
                    setMemberNames({ ...memberNames, [m.id]: e.target.value })
                  }
                />
              </label>
            ))}
            <label>
              Add people <small>Optional · one name per line</small>
              <textarea
                value={names}
                onChange={(e) => setNames(e.target.value)}
              />
            </label>
            <p>
              People stay in the history when you rename them. Existing splits
              keep their amounts.
            </p>
          </>
        )}
        {form.kind === "expense" && (
          <>
            <label>
              What was it for?
              <input
                autoFocus
                required
                maxLength={160}
                value={title}
                placeholder="Dinner after the hike"
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label>
              Total ({group?.currency})
              <input
                required
                inputMode="decimal"
                value={total}
                onChange={(e) => setTotal(e.target.value)}
                placeholder="0.00"
              />
            </label>
            {personSelect("Paid by", payer, setPayer)}
            <label>
              Date
              <input
                required
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <label>
              Split method
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as SplitMode)}
              >
                <option value="equal">Equally</option>
                <option value="exact">Exact amounts</option>
                <option value="percentage">Percentages</option>
              </select>
            </label>
            <fieldset>
              <legend>Who shares this expense?</legend>
              {group?.members.map((m) => (
                <div className="shared-share" key={m.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={participants.includes(m.id)}
                      onChange={(e) =>
                        setParticipants(
                          e.target.checked
                            ? group.members
                                .map((v) => v.id)
                                .filter(
                                  (id) =>
                                    participants.includes(id) || id === m.id,
                                )
                            : participants.filter((id) => id !== m.id),
                        )
                      }
                    />
                    {m.name}
                  </label>
                  {participants.includes(m.id) &&
                    (mode === "equal" ? (
                      <span>
                        {preview?.shares.find((s) => s.memberId === m.id)
                          ? money(
                              preview.shares.find((s) => s.memberId === m.id)!
                                .amountPaise,
                              group.currency,
                            )
                          : "—"}
                      </span>
                    ) : (
                      <input
                        aria-label={`${m.name} ${mode === "percentage" ? "percentage" : "share"}`}
                        inputMode="decimal"
                        placeholder={
                          mode === "percentage" ? "%" : group.currency
                        }
                        value={weights[m.id] || ""}
                        onChange={(e) =>
                          setWeights({ ...weights, [m.id]: e.target.value })
                        }
                      />
                    ))}
                </div>
              ))}
            </fieldset>
            {total && (
              <p className="shared-preview" role="status">
                {preview?.error ||
                  `All ${money(rupeesToPaise(total), group!.currency)} allocated. Rounding is distributed fairly to the smallest currency unit.`}
              </p>
            )}
            {existing && (
              <p>
                Editing recalculates balances. Any repayments already recorded
                stay in history.
              </p>
            )}
          </>
        )}
        {form.kind === "payment" && (
          <>
            {personSelect("Who paid?", payer, setPayer)}
            {personSelect("Who received it?", recipient, setRecipient)}
            <label>
              Amount ({group?.currency})
              <input
                autoFocus
                required
                inputMode="decimal"
                value={total}
                onChange={(e) => setTotal(e.target.value)}
              />
            </label>
            <label>
              Date
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <label>
              Note <small>Optional</small>
              <input
                value={note}
                maxLength={500}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Bank transfer"
              />
            </label>
            <label className="shared-check">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              This money has already been paid.
            </label>
            <details>
              <summary>Different from the suggested amount?</summary>
              <label className="shared-check">
                <input
                  type="checkbox"
                  checked={overpay}
                  onChange={(e) => setOverpay(e.target.checked)}
                />
                Record an overpayment or another actual payment, even if it
                reverses who owes whom.
              </label>
            </details>
            <p>
              This records the repayment here. It doesn’t send money or create a
              bank transaction.
            </p>
          </>
        )}
        {form.kind === "void" && (
          <p>
            This removes its effect on the group balance and keeps a cancelled
            record in history. Previous repayments remain, so someone may now be
            owed a refund. No bank payment is changed.
          </p>
        )}
        {error && (
          <p role="alert" className="shared-error">
            {error}
          </p>
        )}
        <div className="shared-form-actions">
          <button
            type="button"
            className="shared-secondary"
            disabled={busy}
            onClick={close}
          >
            {form.kind === "void" ? "Keep record" : "Cancel"}
          </button>
          <button
            className="af-primary"
            type="submit"
            disabled={busy || (form.kind === "payment" && !confirmed)}
          >
            {busy
              ? "Saving…"
              : form.kind === "void"
                ? "Cancel record"
                : form.kind === "payment"
                  ? "Record payment"
                  : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
