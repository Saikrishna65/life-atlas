# Repayment matching and Atlas Finance performance

## Use it

Review an incoming bank alert, paste a received-payment message, or add/edit an incoming payment. Choose **Money from your roommate? → Match repayment → Room expenses · [person]**. The default remains **No repayment match**; nothing is inferred or applied automatically from a bank name. Approve or save the payment once.

If you pay INR 1,000 for groceries and your friend sends INR 500 back:

- Your bank records the real INR 1,000 debit and one INR 500 credit.
- The room group records one linked INR 500 settlement and clears your friend's balance.
- Finance shows INR 500 net spending and **no INR 500 earnings**. Monthly review separates roommate repayments from merchant refunds.

Partial payments leave the remainder owed. Receiving more than the current debt requires explicit confirmation; the extra becomes a credit. If the same payment was already recorded manually in the group, choose it under **Already recorded this payment?** to link it rather than settle it twice. Matching existing entries requires the same payer, recipient and full amount.

You can also match an already recorded incoming payment in category review. The received money is classified under **Shared repayments**, regardless of an earlier salary/category guess. Clearing the match restores its previous kind/category and cancels its linked settlement; the actual bank credit remains. When the link adopted a pre-existing manual settlement, clearing it restores that manual record instead of deleting it. Reversal/deletion of the real bank payment cancels its settlement. Any credit owed after a bill is later canceled remains visible.

Bank-linked settlements are edited through Atlas Finance; independent edits/cancellation in the group workspace are blocked. Existing independent manual settlements retain their controls. The bank payment, group settlement, balances, category insertion, audit receipts and outbox commit in one IndexedDB transaction. Failure rolls back all changes. Version checks and current group-balance checks protect against stale/concurrent edits and over-settlement. Backups validate the financial links and preserve them through encrypted restore, including when the device time zone changes. Saved group calendar labels are not treated as proof of a bank timestamp.

## Speed changes

- Fourteen Finance dialogs now load only when opened and are not mounted while closed. First-open forms also receive current accounts/data rather than values captured when the dashboard first mounted.
- One page-lifetime, memory-only snapshot is reused when switching report periods. Writes, explicit refresh and resume invalidate it. Failed snapshots can retry, and late obsolete results cannot replace newer state. No persistent duplicate database or completed shared-group cache is introduced.
- Pending-notification changes update lightweight status/widget data rather than reread the entire journal. Native tracking status no longer delays dashboard readiness. Native widget writes coalesce and identical values are not rewritten.
- Shared-expense and repayment pickers coalesce concurrent group reads. There is no added model, cloud request, polling loop, background service or new dependency.
- All changes are scoped to Atlas Finance and its existing shared-group/reporting integrations. Public hero/globe, galleries, music, cloud credentials and Android assistant logic are untouched.

## Measurements

`startup-benchmark.mjs` serves the offline web bundle in isolated desktop Chromium with a 390px viewport. Both runs count JavaScript requested through dashboard readiness plus one second of grace, without network compression. See `performance.json` for the recorded values. This measures a browser fixture, not APK size, real network speed, phone startup or battery drain. Single-run readiness times are context only, not a validated timing improvement.

Measured initial JavaScript: **867,257 → 752,035 bytes**, **13.3% less**. Chunk count changes with code splitting; this is transferred source size, not compressed network traffic or APK size.

The repayment browser test instruments IndexedDB journal reads: changing the report period makes **zero additional transaction-store scans** while the snapshot is current. Mutation and resume paths still invalidate the snapshot.

## Verification

- Full TypeScript/JavaScript regression suite: **632 tests passed**, including 20 new cases for repayments, partial/overpayments, invalid parties/payment types, editing/unmatching, reversals/deletion, rollback, concurrent writes, linking a manual settlement, backups, incoming-notification approval and snapshot caching.
- TypeScript and scoped ESLint checks.
- Mobile/desktop browser tests at 390px and 1280px: incoming-message review, previews, credit/settlement accuracy, earnings exclusion, correction, source controls, unmatching and journal-read reuse. Existing Finance dashboard, split-review, shared-group and monthly-review flows are also checked with isolated synthetic records.
- Offline web assets and production Next build only. Existing unavailable local PostgreSQL queries use their existing public-page fallbacks.

No APK was built, no physical device or battery test was performed, and no code was pushed or personal/cloud data uploaded.

## Current limits

Matching applies the **whole incoming transaction to one person in one group**. A partially paid debt works; allocating a single mixed-purpose bank transfer across multiple groups or between a repayment and a gift is not implemented. Leave mixed-purpose transfers unmatched until reviewed. Outgoing repayments still use explicit group settlement entry. Manual-payment linking is a user choice, not automatic duplicate detection. Current balances and suggestions depend on the expenses and settlements actually recorded in the group.
