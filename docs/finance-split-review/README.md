# Atlas Finance: split a payment during review

## Everyday room expenses

Create **Room expenses** once under **Atlas Finance → Shared expenses** and add your roommate. When reviewing a bank alert, choose the category, then choose **Split with → Room expenses · [friend]**. The default is **Just me**. The preview shows both shares. Approve once to record the payment and the linked equal split together.

Example: you pay INR 1,000 for groceries. Your bank account records one INR 1,000 outflow; the room group records that your friend owes you INR 500. The group does not add a second bank expense.

The same choice is available when pasting a bank message, adding/editing a manual expense, or reviewing an existing uncategorized payment. Category review now has an explicit **Save review** button, allowing category and split to be chosen before saving. Remembering a merchant category is optional and does not remember or automatically apply a shared split.

## Linked-payment behavior

- Every linked expense has a stable `sourceTransactionId`; the transaction stores the chosen group and participant IDs. Editing the payment recalculates that one expense rather than creating another.
- The actual payer is **you**, because this is your account's outgoing payment. Add a friend-paid bill directly in the shared group instead.
- Only posted outgoing purchases can be split. Income, refunds, pending entries and transfers cannot create these linked splits. Group and transaction currency must match; no currency conversion occurs.
- Equal splitting allocates every minor unit deterministically. Selected participant IDs are captured at selection time; adding somebody later never silently includes them in an already chosen split.
- Clearing the split with **Just me**, moving it to another group, reversing or deleting the bank entry cancels its old group expense. Cancelled entries remain in group history. Existing repayments are preserved, so a refund may be owed to somebody.
- Returning a payment to its previous group reuses the same linked expense rather than making a duplicate.
- Linked amounts and splits are edited in Atlas Finance, not independently in the group workspace. Manually created group bills retain their existing edit/cancel controls.
- A retry cannot create another bank payment or another linked expense. If a duplicate alert already belongs to a different split, the user is directed to edit the existing transaction instead of silently changing it.

## Reliability and data

The existing staged ledger commit reads the relevant groups and writes the journal, balances, pockets, group changes, audit receipts and outbox in **one IndexedDB read/write transaction**. Any failure rolls everything back. Concurrent group repayments and bank edits serialize through IndexedDB, and existing transaction-version checks reject stale editors. Ordinary unsplit payments do not read or lock the shared-group store.

Existing Finance backups contain both stores. Restore validation now rejects active bank splits without a matching source payment, inconsistent amounts/shares, or a payment missing its linked expense. Cancelled history can retain a reference to a deleted payment. Existing unlinked records and old backups remain compatible; database names, routes and IDs were not renamed. No new cloud synchronization, native permissions, background tasks, models or dependencies were added.

Visible branding now says **Atlas Finance** on the private home card, assistant replies, native voice navigation label and Android widget picker. The legacy “finance vault” spoken phrase remains an alias. The Android resource/voice text will take effect in a future APK update; no APK was built for this change.

## Limits

Bank-linked splits are currently equal splits. Exact/percentage bills are still supported for manually entered group expenses. Incoming roommate repayments can now be explicitly linked during review; see the [repayment guide](../finance-repayments/README.md). Merchant refunds are not automatically matched to a shared bill. Group data is local and private, not sent to the public website or to another person's phone.

## Validation

- TypeScript and scoped ESLint for the changed Finance services, controls and review components.
- Full JavaScript/TypeScript regression suite: **612 passed**, including 17 new transaction-split cases: atomic creation/rollback, missing/cross-currency groups, invalid people/payment types, corrections, Just me, group moves, reversals/deletion, stale editors, source protections, concurrency, category approval, notification approval/retry, participant snapshots and encrypted backup restoration.
- Browser checks at 390px and 1280px cover pasted bank-message approval with category and split, preview amounts, correction propagation, manual splits, group source controls, Just me and category review. They verify no duplicate bank debit, no horizontal overflow and no page errors. Isolated synthetic data only; external requests are blocked.
- Existing Finance dashboard and shared-group browser regressions passed at both widths.
- `npm run build:mobile` produces only offline web assets. Production web compilation passed. Existing public-page PostgreSQL queries log the unavailable local database and use their existing fallbacks. No APK build, device test, deployment, push or personal/cloud-data upload.

Screenshots are in [previews](./previews/).
