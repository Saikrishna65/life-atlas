# Finance Vault reliability and daily-use improvements

26 November 2026. Source-only changes on `feature/atlas-local-intelligence`, following `144d380`. Core implementation commit: `36223e2`. No APK build, main merge, push, deployment, cloud operation or modification of personal finance data was performed.

## Accuracy changes

- Transaction creation, two-leg transfers, corrections, reversals and deletion now stage writes while asynchronous validation/auth/trip lookup runs. A single IndexedDB read/write transaction then commits the ledger, affected account balances, savings allocations, audit receipts and sync outbox together. A failure aborts all these writes.
- Account balances are recomputed from the journal inside the commit, avoiding races between separate balance recalculations. Reports/forecasts also derive posted balances instead of trusting an interrupted older cache update. Reads do not silently rewrite an old saved cache.
- Transaction/pocket version checks reject concurrent changes. The editor also sends its original version so a stale form cannot overwrite a newer correction. Concurrent duplicate recording is checked again inside the commit.
- Deleting a transfer removes both legs. One-sided changes to transfer amount/direction/status reject with guidance to reverse/recreate the transfer. Both account balances update together.
- Reversing and later deleting a payment restores its pocket allocation once. Editing amount, direction, pocket or reversal status restores/reapplies the appropriate allocation. Validation failures cannot consume pocket money.
- Explicitly marked refunds reduce net spending instead of inflating income. Cash flow, category reports/comparisons, budgets and estimates use that distinction. Refund-only chart buckets have positive visual dimensions with a distinct refund treatment and retain their negative financial value.
- Transaction timestamps are normalized on entry and duplicate fingerprints normalize legacy offsets. The shared query selector still compares actual instants, preserving existing offset-dated records; no unsafe lexical-date index shortcut or data migration was introduced.
- INR summaries keep other currencies separate; there is no implicit USD-to-INR addition or fabricated exchange rate. Cross-currency transfers reject. Wallet/activity amounts retain their account/transaction currency. Full foreign-currency budget/pocket conversion is not implemented.
- “All Time” starts at the earliest saved transaction rather than a fixed 2020 cutoff.

## Speed changes

- The dashboard reads accounts, ledger, categories, pockets and recurring rules in one consistent readonly transaction. Unsynced work uses index counts rather than loading completed/pending sync payloads. It is not capped at the previous 50-operation queue fetch.
- All reporting for a refresh uses a refresh-scoped in-memory facade. No financial cache is added to localStorage or a global session cache. The ledger is read once per snapshot rather than reread for each report.
- A queue coalesces bursts and permits only one active refresh plus one latest follow-up. Initial double refresh was removed. Native notification initialization no longer gates reading saved finances.
- Snapshot results retain generation guards and invalidate on unmount. Existing content stays visible on refresh failure, with a retry action.
- Activity renders 60 rows initially with explicit next batches. Search/filter changes use the loaded records; Clear filters restores the initial batch. This limits DOM work, not the underlying database history.
- An isolated synthetic desktop test processed 10,000 records plus reports in 144.8 ms; a full parallel suite run recorded 312.3 ms. Both made one persisted ledger read. These are fake-indexeddb/Node measurements under different CPU load, **not Android startup or device performance**. No whole-dashboard before/after phone timing was measured.

## Daily-use changes

- Net worth is labeled as assets minus debt. “Available to spend” is separate: posted bank/cash/savings balances minus pending outgoing payments and pocket allocations, before upcoming bills. Pending income is shown separately and excluded. Wallet availability uses the same holds/allocations distinction.
- Clearly labeled Expense, Income, Transfer and Import controls, with mobile touch-sized layout. Amount fields support a decimal keypad.
- Transaction and transfer forms initialize when opened. Refreshing accounts while editing no longer resets a draft. Description or merchant name is sufficient; a refund can be marked directly when entering income.
- Income/expense summary controls open the relevant period and transaction types. Search, next batches and Clear filters work locally. Marked refunds are included in spending exploration.
- Loading is a small initial notice rather than replacing the whole page; initial net worth uses a placeholder rather than a misleading zero. Storage/refresh failures show a useful retry message.

## Validation

| Check | Result |
|---|---|
| Full test suite | **563 passed, 0 failed, 0 skipped**, including existing security, gallery, music, publishing, R2 and AI tests |
| Finance suite | **188 passed** in the final dedicated finance run; 14 new reliability regressions |
| Atomicity tests | Concurrent duplicate protection; forced audit failure rolls back transaction/account/outbox; invalid trip/pocket rollback; transfer pair deletion; reversal/delete allocation; same-pocket amount corrections; stale editor rejection |
| Reporting tests | Refund consistency; posted-versus-spendable/pending income; foreign currency isolation; stale cached balances; one persisted ledger read for 10k records; outbox index counts; refresh queue coalescing |
| TypeScript | Passed `tsc --noEmit`; production build also type checked |
| Scoped ESLint | Passed for modified finance services/domain/storage, dashboard, forms, chart and regression tests; no new suppression rules |
| Production build | Passed; recorded compile 6.8 s and TypeScript 22.4 s in one final run. Existing unavailable-Prisma content fetches followed existing fallbacks |
| Mobile JS bundle | Passed; no Android/APK build |
| Browser | Actual Chromium at 390/1280 px, isolated synthetic records: existing data, pending holds, matching wallet availability, transaction/transfer draft retention, refund creation, 60-row pagination, search/reset, refund-only chart, pre-2020 All Time totals, no horizontal overflow or page errors |
| Whitespace | `git diff --check` passed |

Browser screenshots contain synthetic test accounts and payments only: [mobile](previews/finance-390.png), [desktop](previews/finance-1280.png). They are browser captures, not phone screenshots.

## Scope and remaining limits

The existing database schema, originals, authentication defaults, backup encryption, private vaults, R2, Atlas Video and public website hero/globe are unchanged. Transaction deletion still follows the existing optional deletion authentication policy. System categories may still be seeded in an empty Finance database through the established flow.

The atomic boundary covers the five transaction-service operations above; it does not claim that every independent account/pocket-management service or a complete CSV file is one transaction. Legacy `runInTransaction` callback coordination is now documented honestly; an import's individual ledger records are atomic, not its entire input file. Existing partial-import/error handling remains.

The full ledger is still loaded for current dashboard analytics; DOM pagination is not database virtualization. Very large histories can later use incremental aggregates and indexed paging. No actual phone latency, memory, battery, background bank-notification capture, encrypted device restore or native installer behavior was measured. Do not infer those results from desktop tests. No cloud synchronization success is claimed.

Additional useful work, after phone testing: statement/closing-balance reconciliation, receipt attachments and OCR-assisted entry, matching refunds to original purchases/trips, shared-expense settlement, own-account transfer suggestions from paired bank alerts, and subscription price-change warnings. Existing budgets, recurring rules, forecasts and backups already exist; they are not presented as new proposals.
