"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  Copy,
  TrendingUp,
  TrendingDown,
  CalendarDays,
  CheckCircle2,
  Info,
} from "lucide-react";
import { IndexedDBUnitOfWork } from "@/lib/finance/storage/indexeddb/unitOfWork";
import type { FinanceDashboardRecords } from "@/lib/finance/storage/interfaces";
import { buildMonthlyReview } from "@/lib/finance/review/monthlyReview";
import { localFinanceDateKey } from "@/lib/finance/calendar";
import "./review.css";

const money = (value: number, currency: string) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(
    value / 100,
  );
const monthName = (key: string) =>
  new Date(`${key}-15T12:00:00`).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
const repeatLabel = (frequency: string, interval: number) => {
  const unit =
    (
      {
        daily: "day",
        weekly: "week",
        biweekly: "fortnight",
        monthly: "month",
        quarterly: "quarter",
        yearly: "year",
      } as Record<string, string>
    )[frequency] || "cycle";
  return interval === 1 ? `Every ${unit}` : `Every ${interval} ${unit}s`;
};
const shifted = (key: string, offset: number) => {
  const [y, m] = key.split("-").map(Number);
  return localFinanceDateKey(new Date(y, m - 1 + offset, 1)).slice(0, 7);
};
export default function MonthlyReview() {
  const [records, setRecords] = useState<FinanceDashboardRecords | null>(null),
    [month, setMonth] = useState(""),
    [currency, setCurrency] = useState("INR");
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [refreshing, setRefreshing] = useState(false),
    [now, setNow] = useState<Date | null>(null),
    [visibleFlags, setVisibleFlags] = useState(10);
  const request = useRef({ sequence: 0 }),
    uow = useRef<IndexedDBUnitOfWork | null>(null);
  const refresh = useCallback(async () => {
    const sequence = ++request.current.sequence;
    setRefreshing(true);
    try {
      uow.current ||= new IndexedDBUnitOfWork();
      const snapshot = await uow.current.readDashboardRecords();
      if (sequence !== request.current.sequence) return;
      const date = new Date();
      setRecords(snapshot);
      setNow(date);
      setMonth((value) => value || localFinanceDateKey(date).slice(0, 7));
      setError("");
      const currencies = new Set([
        ...snapshot.accounts.map((a) => a.currency),
        ...snapshot.transactions.map((t) => t.currency),
      ]);
      setCurrency((value) =>
        currencies.size && !currencies.has(value)
          ? [...currencies].sort()[0]
          : value,
      );
    } catch (e) {
      if (sequence === request.current.sequence)
        setError(
          e instanceof Error
            ? e.message
            : "Could not read your local Finance records.",
        );
    } finally {
      if (sequence === request.current.sequence) setRefreshing(false);
    }
  }, []);
  useEffect(() => {
    const gate = request.current;
    const timer = setTimeout(() => {
      void refresh();
    }, 0);
    const updated = () => {
        void refresh();
      },
      visible = () => {
        if (!document.hidden) updated();
      };
    window.addEventListener("finance-ledger-updated", updated);
    document.addEventListener("visibilitychange", visible);
    return () => {
      ++gate.sequence;
      clearTimeout(timer);
      window.removeEventListener("finance-ledger-updated", updated);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [refresh]);
  const result = useMemo(() => {
    if (!records || !month || !now) return { review: null, error: "" };
    try {
      return {
        review: buildMonthlyReview({
          ...records,
          rules: records.rules,
          month,
          currency,
          now,
        }),
        error: "",
      };
    } catch (e) {
      return {
        review: null,
        error:
          e instanceof Error ? e.message : "Could not calculate this review.",
      };
    }
  }, [records, month, currency, now]);
  const review = result.review,
    currencies = [
      ...new Set([
        "INR",
        ...(records?.accounts.map((a) => a.currency) || []),
        ...(records?.transactions.map((t) => t.currency) || []),
      ]),
    ].sort(),
    currentKey = now ? localFinanceDateKey(now).slice(0, 7) : "";
  const accountNames = new Map(
    records?.accounts.map((a) => [a.id, a.name]) || [],
  );
  const categoryMaximum = Math.max(
    1,
    ...(review?.categories.map((c) => Math.abs(c.currentPaise)) || []),
  );
  const changeMonth = (value: string) => {
    setMonth(value);
    setVisibleFlags(10);
    setNotice("");
  };
  async function copySummary() {
    if (!review) return;
    const change = review.comparison
      ? `${review.comparison.deltaPaise > 0 ? "+" : ""}${money(review.comparison.deltaPaise, currency)} compared with last month (${review.comparisonLabel})`
      : "Not enough recorded activity last month to compare.";
    try {
      await navigator.clipboard.writeText(
        [
          `Atlas · ${monthName(month)} · ${currency}`,
          `Recorded spending: ${money(review.totals.spendingPaise, currency)}`,
          `Income: ${money(review.totals.incomePaise, currency)}`,
          `Refunds: ${money(review.totals.refundsPaise, currency)}`,
          change,
          `Recorded regular bills, net of linked refunds: ${money(review.regularPaidPaise, currency)}`,
          `Current monthly commitments (estimate): ${money(review.monthlyCommitmentPaise, currency)}`,
          `${review.flags.length} transactions worth checking. Patterns are suggestions, not fraud findings.`,
          "Based only on local recorded activity; no currency conversion.",
        ].join("\n"),
      );
      setNotice("Review copied.");
    } catch {
      setNotice(
        "Copy is unavailable in this browser. Your review is still available below.",
      );
    }
  }
  return (
    <main className="monthly-review">
      <header className="mr-header">
        <Link href="/secret/finance">
          <ArrowLeft size={18} />
          Finance
        </Link>
        <button onClick={() => void refresh()} disabled={refreshing}>
          <RefreshCw size={16} className={refreshing ? "mr-refreshing" : ""} />
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </header>
      <div className="mr-intro">
        <span>YOUR MONEY, IN PERSPECTIVE</span>
        <h1>
          Your month.
          <br />A little clearer.
        </h1>
        <p>What changed, what repeats, and what deserves a second look.</p>
      </div>
      {(error || result.error) && (
        <p className="mr-error" role="alert">
          {error || result.error}
        </p>
      )}
      {!records && !error && (
        <p role="status" className="mr-loading">
          Opening your local monthly review…
        </p>
      )}
      {records && month && (
        <div className="mr-toolbar">
          <div className="mr-month">
            <button
              aria-label="Previous month"
              disabled={month <= "1900-01"}
              onClick={() => changeMonth(shifted(month, -1))}
            >
              <ArrowLeft size={18} />
            </button>
            <label>
              <span className="mr-sr">Review month</span>
              <input
                aria-label="Review month"
                type="month"
                min="1900-01"
                max={currentKey}
                value={month}
                onChange={(e) => {
                  if (e.target.value) changeMonth(e.target.value);
                }}
              />
            </label>
            <button
              aria-label="Next month"
              disabled={month >= currentKey}
              onClick={() => changeMonth(shifted(month, 1))}
            >
              <ArrowRight size={18} />
            </button>
          </div>
          <label className="mr-currency">
            Currency
            <select
              aria-label="Currency"
              value={currency}
              onChange={(e) => {
                setCurrency(e.target.value);
                setVisibleFlags(10);
              }}
            >
              {currencies.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <button
            className="mr-copy"
            onClick={() => void copySummary()}
            disabled={!review}
          >
            <Copy size={16} />
            Copy summary
          </button>
        </div>
      )}
      {notice && (
        <p role="status" className="mr-notice">
          {notice}
        </p>
      )}
      {review && (
        <>
          <section className="mr-hero" aria-label="Monthly spending">
            <div>
              <span>
                {monthName(month)}
                {review.currentMonth ? " · so far" : ""}
              </span>
              <h2>{money(review.totals.spendingPaise, currency)}</h2>
              <p>Recorded spending, after refunds</p>
              {review.comparison ? (
                <div className="mr-change">
                  {review.comparison.deltaPaise > 0 ? (
                    <TrendingUp size={19} />
                  ) : (
                    <TrendingDown size={19} />
                  )}
                  <strong>
                    {review.comparison.deltaPaise === 0
                      ? "Unchanged from last month"
                      : `${money(Math.abs(review.comparison.deltaPaise), currency)} ${review.comparison.deltaPaise > 0 ? "more" : "less"}`}
                  </strong>
                  {review.comparison.percent !== null && (
                    <span>
                      ({Math.abs(review.comparison.percent).toFixed(1)}%)
                    </span>
                  )}
                </div>
              ) : (
                <p className="mr-baseline">
                  No recorded activity in the comparison period. A change
                  percentage would be misleading.
                </p>
              )}
              <small>
                {review.comparisonLabel}
                {review.comparison && review.currentMonth
                  ? ` · compared spending ${money(review.comparison.currentPaise, currency)} vs ${money(review.comparison.previousPaise, currency)}`
                  : ""}
              </small>
            </div>
            <div className="mr-hero-stats">
              <div>
                <span>Income</span>
                <strong>{money(review.totals.incomePaise, currency)}</strong>
              </div>
              <div>
                <span>Purchases before refunds</span>
                <strong>{money(review.totals.purchasesPaise, currency)}</strong>
              </div>
              <div>
                <span>Refunds received</span>
                <strong>{money(review.totals.refundsPaise, currency)}</strong>
              </div>
              <div>
                <span>Income minus spending</span>
                <strong>{money(review.netPaise, currency)}</strong>
              </div>
            </div>
          </section>
          <p className="mr-quality">
            <Info size={16} />
            <span>
              {review.totals.count} posted entries · {review.pendingCount}{" "}
              {review.pendingCount === 1 ? "pending entry" : "pending entries"}{" "}
              and {review.excludedTransferCount}{" "}
              {review.excludedTransferCount === 1 ? "transfer" : "transfers"}{" "}
              excluded.{" "}
              {review.totals.spendingPaise < 0
                ? "Refunds exceed purchases this month. "
                : ""}
              Missing imports can affect this review. Currencies are kept
              separate.
            </span>
          </p>
          {!review.totals.count && (
            <section className="mr-empty">
              <CalendarDays size={30} />
              <h2>No recorded activity for this month.</h2>
              <p>
                Choose another month or add payments in Finance. Atlas won’t
                fill the gaps with estimates.
              </p>
            </section>
          )}
          <div className="mr-columns">
            <section className="mr-panel">
              <div className="mr-panel-heading">
                <span>01 / THE CHANGES</span>
                <h2>Where your money went</h2>
                <p>
                  {review.comparisonLabel}. Refunds reduce their recorded
                  category’s total.
                </p>
              </div>
              {!review.categories.length ? (
                <p className="mr-muted">No spending categories to show.</p>
              ) : (
                <div className="mr-categories">
                  {review.categories.map((category) => (
                    <article key={category.id}>
                      <div>
                        <strong>{category.name}</strong>
                        <span>{money(category.currentPaise, currency)}</span>
                      </div>
                      <div className="mr-category-track" aria-hidden="true">
                        <i
                          style={{
                            width: `${Math.min(100, (Math.abs(category.currentPaise) / categoryMaximum) * 100)}%`,
                          }}
                        />
                      </div>
                      <p>
                        {review.comparison
                          ? `${category.deltaPaise === 0 ? "No change" : `${money(Math.abs(category.deltaPaise), currency)} ${category.deltaPaise > 0 ? "more" : "less"}`} · previously ${money(category.previousPaise, currency)}`
                          : "No comparison available"}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </section>
            <section className="mr-panel">
              <div className="mr-panel-heading">
                <span>02 / WHAT REPEATS</span>
                <h2>Subscriptions & regular bills</h2>
                <p>
                  Only explicitly linked or marked automatic payments are
                  counted here. Ordinary repeat purchases aren’t assumed to be
                  subscriptions.
                </p>
              </div>
              <div className="mr-regular-total">
                <span>Recorded this month, after linked refunds</span>
                <strong>{money(review.regularPaidPaise, currency)}</strong>
              </div>
              {review.regularPayments.length ? (
                <ul className="mr-bill-list">
                  {review.regularPayments.map((p) => (
                    <li key={p.id}>
                      <span>
                        {p.name}
                        <small>
                          {p.count} recorded{" "}
                          {p.count === 1 ? "entry" : "entries"}
                        </small>
                      </span>
                      <b>{money(p.amountPaise, currency)}</b>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mr-muted">
                  No linked regular-bill payments recorded this month.
                </p>
              )}
              <details className="mr-commitments">
                <summary>
                  Current commitments{" "}
                  <b>{money(review.monthlyCommitmentPaise, currency)}/month</b>
                </summary>
                <p>
                  Estimate from today’s confirmed recurring bills, regardless of
                  the review month. Annual and quarterly bills are spread across
                  months; weekly and daily schedules use 52 weeks and 365 days
                  per year. This is not the amount charged this month. Paused
                  and unconfirmed patterns are excluded. Estimates follow your
                  saved amounts and repeat intervals; check those if the total
                  looks wrong.
                </p>
                {review.commitments.length ? (
                  <ul className="mr-bill-list">
                    {review.commitments.map(({ rule, monthlyPaise }) => (
                      <li key={rule.id}>
                        <span>
                          {rule.merchant || rule.description}
                          <small>
                            {repeatLabel(rule.frequency, rule.interval)}
                            {rule.isEstimate ? " · estimated amount" : ""}
                          </small>
                        </span>
                        <b>{money(monthlyPaise, currency)}/mo</b>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No confirmed regular bills yet.</p>
                )}
                {review.candidateRules > 0 && (
                  <p>
                    {review.candidateRules} unconfirmed pattern
                    {review.candidateRules === 1 ? "" : "s"} not included.
                  </p>
                )}
              </details>
            </section>
          </div>
          <section className="mr-panel mr-checks">
            <div className="mr-panel-heading">
              <span>03 / A SECOND LOOK</span>
              <h2>Worth checking</h2>
              <p>
                A few payments that stand out from your earlier spending. These
                are suggestions, not fraud findings.
              </p>
            </div>
            <details className="mr-method">
              <summary>How these checks work</summary>
              <p>
                Suggestions, not fraud findings. Large-payment checks require at
                least 3 earlier merchant payments or 5 category payments in the
                preceding 90 days. The amount must be at least 3× the median and{" "}
                {money(currency === "INR" ? 50000 : 2000, currency)} above it.
              </p>
            </details>
            {!review.flags.length ? (
              <div className="mr-check-empty">
                <CheckCircle2 size={23} />
                <div>
                  <strong>No transactions flagged by these checks.</strong>
                  <p>
                    {review.historyCount < 3
                      ? "There is too little earlier spending to establish an amount pattern."
                      : "This doesn’t guarantee every entry is correct; smaller or new-merchant issues may not be detected."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="mr-flags">
                {review.flags
                  .slice(0, visibleFlags)
                  .map(({ transaction: t, reason, medianPaise }) => (
                    <details key={t.id}>
                      <summary>
                        <div>
                          <strong>{t.merchant || t.description}</strong>
                          <span>
                            {localFinanceDateKey(t.occurredAt)} ·{" "}
                            {accountNames.get(t.accountId) ||
                              "Recorded account"}
                          </span>
                        </div>
                        <b>
                          {money(t.amountPaise, currency)}
                          {t.direction === "inflow" ? " in" : ""}
                        </b>
                      </summary>
                      <p>{reason}.</p>
                      {medianPaise !== undefined && (
                        <p>Earlier median: {money(medianPaise, currency)}.</p>
                      )}
                      <dl>
                        <dt>Description</dt>
                        <dd>{t.description}</dd>
                        <dt>Source</dt>
                        <dd>{t.source.replaceAll("_", " ")}</dd>
                        {t.notes && (
                          <>
                            <dt>Your note</dt>
                            <dd>{t.notes}</dd>
                          </>
                        )}
                      </dl>
                      <p>
                        Review or correct this entry in Finance. This summary
                        never changes it automatically.
                      </p>
                    </details>
                  ))}
                {review.flags.length > visibleFlags && (
                  <button
                    className="mr-more"
                    onClick={() => setVisibleFlags((v) => v + 10)}
                  >
                    Show next {Math.min(10, review.flags.length - visibleFlags)}{" "}
                    entries
                  </button>
                )}
              </div>
            )}
          </section>
          <footer className="mr-footer">
            <span>
              Private review · based on the records saved on this device.
            </span>
            {review.firstRecordedDay && (
              <span>
                First recorded activity in {currency}: {review.firstRecordedDay}
              </span>
            )}
          </footer>
        </>
      )}
    </main>
  );
}
