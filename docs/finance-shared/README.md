# Shared expenses and settlements

Open **Finance → Shared expenses → Open groups**. This is a local, private group ledger; nothing is published to the website or sent to other people.

## Using it

1. Create a group, enter the other participants (one per line), and choose INR, USD, EUR or GBP. Optionally link an existing local trip. Currency stays fixed for that group.
2. Add a bill, choose who paid and who shares it. Split equally, enter exact amounts, or enter percentages. The live preview validates the total. A payer need not be a beneficiary.
3. Review each person’s balance and the suggested payments. Suggestions simplify the group’s overall debts; they need not follow the original payer/borrower pairs.
4. After someone actually pays, record the repayment and confirm it happened. Partial payments work. An explicit extra confirmation permits real overpayments or payments outside the suggested balance.
5. Edit a bill or cancel an incorrect expense/payment. Cancelled records stay visible. Cancelling a bill does not erase money already repaid, so it can correctly show a refund owed.
6. Rename or add participants through the pencil button beside the group title. Existing shares retain their participant IDs and amounts. Copy a balance summary if desired; Atlas does not send it anywhere.

Bank balances and spending reports keep their existing meaning. Shared entries and repayment records **do not create bank transactions, change account balances or move money**. Record actual bank activity separately, once. There is no automatic reimbursement matching, currency conversion, online multi-user collaboration, reminder delivery, or payment-provider integration.

## Storage and reliability

- Finance IndexedDB upgrades from version 4 to 5 by adding `shared_groups`; existing records are preserved. Each group is a versioned aggregate containing members, bills, allocations and repayments.
- Monetary calculations use integer minor units. Percentage allocation uses `BigInt` multiplication and largest remainders, with stable participant-order ties. Every share reconciles to its bill and every group balances to zero.
- A group and its audit receipt commit atomically. Receipts preserve changed records before and after an edit without copying the entire group history. Optimistic version checks reject stale edits rather than overwrite them.
- The existing optional deletion-authentication policy applies to cancellation. No new authentication requirement is introduced.
- History renders 50 records at a time; all records still contribute to balances.
- Visibility and cross-tab events refresh local data; no polling or cloud calls. Forms retain their draft during refresh. Browser/Android Back closes the form, as does Escape.
- The separate page loads lazily in the offline app; Finance does not eagerly load its workspace. There are no new package dependencies or background services.
- Groups are included in existing encrypted Finance backups and validated on restore. Complete version-4 backups are normalized into version-5 snapshots with an empty shared store. Preview never clears current groups; applying an approved full restore replaces Finance data, including groups, and first creates the existing safety backup.
- A group supports 2–30 participants and up to 5,000 expenses plus 5,000 repayments. Each bill currently has one payer; record multiple bills when costs were paid separately. Groups have independent currencies and are not summed across currencies.

## Validation

Commands and evidence for this implementation:

- `npm test`: **581 passed**, including 18 new shared-expense/backup tests.
- `npx tsc --noEmit`: type checking.
- Scoped ESLint for new shared modules, page and tests.
- `npm run build:mobile`: offline web-asset bundle only, **not an APK**.
- `npm run build`: Next production build. Existing public place/trip queries log an unavailable local PostgreSQL server and use their existing fallbacks; no database configuration was changed.
- `node tests/finance/shared-browser.mjs`: Chromium at 390px and 1280px, synthetic records only, network blocked. Covers group creation, all three split modes, partial repayment, editing, cancellation/refund balances, persistence, participant rename, draft retention, dialog sizing, Escape/Android-back event, page errors and overflow. Verifies accounts/transactions remain empty after group operations.
- `node tests/finance/reliability-browser.mjs`: existing Finance dashboard interaction regression.
- Unit tests cover deterministic rounding, maximum safe integer allocation, invalid shares, missing members, multiple payers, excluded payers, settlement checks, V4 migration, atomic audit receipts, stale writes, restore exclusion, blocked notification channels, encrypted backup round-trip and legacy backup completeness.

Screenshots in [previews](./previews/) show desktop/mobile group and expense forms. These are synthetic browser screenshots, not physical-device validation. No APK, deployment, cloud upload, or push was performed.

## Split an existing bank payment

You can now choose **Split with** during bank-alert approval, manual expense entry/editing and category review. These linked splits follow their original payment and are updated atomically with it; edit them in Atlas Finance. Standalone group bills still do not write bank transactions. See the [linked-payment guide](../finance-split-review/README.md).
