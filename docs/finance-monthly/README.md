# Monthly review

Open **Finance → Monthly review → Review my month**. Select a month and currency to see recorded spending, income, refunds, category changes, regular bills and transactions worth checking. The page is available in the web application and the offline Android web bundle.

## What the figures mean

- Only posted entries count. Pending payments, reversals and transfers between your accounts are excluded. Refunds reduce spending rather than inflate income. A net-negative spending total means refunds exceeded purchases.
- Comparisons for completed months use full calendar months. The current month compares the first N days of each month. N is the smaller of today’s day number and the number of days in the previous month. Today may still be incomplete. For March 31 versus February 28, the comparison uses March 1–28 and February 1–28; the headline still includes all of March so far. Both comparison totals and the date-window explanation are shown.
- No previous-period entries means no comparison. A zero or net-refund previous spending total has no percentage change; an absolute difference is still shown when there are earlier entries. Missing imports/accounts are never interpreted as proven zero spending.
- Categories use those same comparison windows. Removed or missing categories remain visible as uncategorized; refund amounts use their recorded category.
- Currencies are separate. There is no exchange-rate conversion or mixed-currency grand total.
- “Subscriptions & regular bills” shows only payments explicitly linked to a recurring rule or marked as automatic bills. A refund with an original-payment reference can reduce its regular-bill total. Merchant repetition alone does not classify a purchase as a subscription.
- Current monthly commitments are a separate estimate from **today’s confirmed, active recurring schedules**, even when viewing an older month. Paused, unconfirmed, ended, not-yet-started, incoming and transfer-category rules are excluded. Annual/quarterly charges are spread across months; daily/weekly schedules use 365 days/52 weeks per year. The configured interval is respected. Amounts are rounded to integer minor units using BigInt arithmetic. Estimates follow saved schedules; they do not validate or rewrite older, possibly incorrect repeat intervals.
- Amount flags compare a posted purchase with the median of earlier payments in the preceding 90 days, before the selected month. At least 3 merchant samples or 5 category samples are required. Merchant baselines take precedence; descriptions are not treated as reliable merchant identities. The amount must be at least 3× the median and at least INR 500 (or 20 units of another currency) above it. Existing entries marked for review also appear. These are explainable suggestions, not fraud findings or a guarantee that unflagged entries are correct.

## Implementation and performance

- Pure deterministic selector: `src/lib/finance/review/monthlyReview.ts`.
- One consistent read-only IndexedDB snapshot using the existing Finance unit of work. No schema changes, financial writes, persisted duplicate index, AI model, cloud request, package dependency or background service.
- Currency/month switches recalculate from the loaded snapshot without additional DB reads. A refresh sequence prevents stale responses from overwriting newer data. Visibility and existing Finance change events refresh data; there is no polling. Refresh and copy-summary controls work explicitly.
- History is indexed once by merchant/category for checks. Medians are cached per group rather than recalculated for every transaction. Flags render 10 at a time, with a working continuation control. The workspace is lazy-loaded by the existing offline router and does not load with the Finance dashboard.
- The UI includes semantic sections, keyboard controls, native month/currency inputs with accessible names, visible focus, reduced-motion support, empty/error states and mobile-specific layouts.
- Copying the summary requires an explicit button press; Atlas does not send it to anyone. All personal financial records remain unchanged. Existing backups already contain the underlying records, so no separate review data needs backup.

## Validation

- `npm test`: complete regression suite (595 passing tests, including 14 monthly-review tests).
- `npx tsc --noEmit` and scoped ESLint on the new review modules/page/tests.
- `npm run build:mobile`: offline web assets only, not an APK.
- `npm run build`: Next production build. Existing public-page PostgreSQL queries may log the unavailable local database and use existing fallbacks; this feature adds no backend dependency.
- `node tests/finance/monthly-review-browser.mjs`: Chromium at 390px and 1280px, Asia/Kolkata time zone and a fixed test date. Uses isolated synthetic records and blocks external requests. Tests empty state, totals, partial-month comparison, month/currency navigation, bill estimates, explained flags, refresh, clipboard output, unchanged persisted records, page errors and horizontal overflow.
- `node tests/finance/reliability-browser.mjs`: existing Finance dashboard interaction regression.
- Browser screenshots: [phone](./previews/review-390.png), [desktop](./previews/review-1280.png).

No APK build, physical-device test, deployment, push, cloud upload or personal-data modification was performed.
