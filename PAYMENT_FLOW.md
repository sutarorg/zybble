# Payment & Manual Creator Payout Flow

Zybble is an India-only (`INR`, `₹`) digital course marketplace. All monetary values in Postgres, server actions, API routes, and client props are stored and computed in **integer paise** (`100 paise = ₹1.00`).

---

## 1. End-to-End Architecture

1. **Course Creation & Publishing (No Payout Gate)**
   - Creators can create, price in INR, submit for moderation, and publish paid or free courses **without** Razorpay Route onboarding and **without** pre-saving bank or UPI details.
   - A saved payout destination is required **only** when a creator submits a manual payout request.

2. **Learner Checkout (`src/lib/server/checkout.ts`, `src/lib/server/razorpay.ts`)**
   - **Free courses (`price_paise = 0`)**: `enrollFreeCourse()` verifies the course is published and free on the server and grants an `entitlements` row directly without creating a Razorpay order.
   - **Paid courses (`price_paise > 0`)**:
     - `createCourseOrder()` reads `courses.price_paise` and `marketplace_settings.commission_bps` on the server (browser-supplied prices or commissions are never trusted).
     - `splitCommission(pricePaise, commissionBps)` computes `commissionPaise = Math.round((pricePaise * commissionBps) / 10_000)` and `creatorSharePaise = pricePaise - commissionPaise`, guaranteeing `commissionPaise + creatorSharePaise === pricePaise`.
     - `createOrder()` calls Razorpay Standard Checkout `POST /v1/orders` with `{ amount, currency: "INR", receipt, notes }` — **no Razorpay Route `transfers` array is sent**.
     - Zybble inserts an `orders` row (`status = 'created'`), an `order_items` row with the snapshotted `unit_price_paise`, `commission_bps`, `commission_paise`, and `creator_share_paise`, and a `payments` row (`status = 'created'`).

3. **Double Payment Verification & Ledger Recording**
   - A learner never receives course access from a client redirect alone.
   - **Browser callback (`verifyPaymentAndGrantEntitlement`)**:
     1. Verifies the HMAC-SHA256 signature (`razorpay_order_id|razorpay_payment_id` signed with `RAZORPAY_KEY_SECRET` using `crypto.timingSafeEqual`).
     2. Fetches the payment directly from Razorpay (`GET /v1/payments/:id`) and verifies `payment.order_id === razorpayOrderId`, `payment.currency === "INR"`, `payment.amount === order.total_paise`, and `payment.status === "captured"` (auto-capturing if `authorized`).
   - **Signed Webhook (`handleRazorpayWebhook`)**:
     1. Verifies `x-razorpay-signature` over the raw request body using `RAZORPAY_WEBHOOK_SECRET`.
     2. Deduplicates delivery via `x-razorpay-event-id` stored in `webhook_events`.
     3. Handles `payment.captured`, `order.paid`, `payment.failed`, `transfer.reversed`, `transfer.partially_reversed`, `settlement.processed` and `settlement.failed` in any delivery order.
     4. Acknowledges and **ignores** `refund.created`, `refund.processed`, `refund.failed` and `payment.refunded`: Zybble has no refund policy, so no refund is processed from a webhook. The event is still recorded in `webhook_events` and answered with HTTP 200 so Razorpay does not retry it, and a warning is logged for the operator.
   - **Idempotent Settlement (`markOrderPaid`)**:
     - Transitions `orders.status` to `'paid'` and `payments.status` to `'captured'`.
     - Upserts the learner's `entitlements` row (`onConflict: "user_id,course_id"`).
     - Appends immutable `ledger_entries` rows:
       - `kind = 'sale'`, `direction = 'credit'`, `account = 'platform'`, `amount_paise = total_paise`
       - `kind = 'commission'`, `direction = 'credit'`, `account = 'platform'`, `amount_paise = commission_paise`
       - `kind = 'sale'`, `direction = 'debit'`, `account = 'platform'`, `amount_paise = creator_share_paise`
       - `kind = 'sale'`, `direction = 'credit'`, `account = 'creator:<creator_id>'`, `amount_paise = creator_share_paise`

---

## 2. Encrypted Creator Payout Destinations (`src/lib/server/payout-crypto.ts`)

Creators configure **one active payout destination at a time** in `/creator/payouts`:

- **Option A — UPI (VPA)**:
  - Beneficiary / account holder name
  - Indian UPI ID / VPA (validated against `UPI_VPA_REGEX`, e.g. `name@okaxis`)
- **Option B — Bank Transfer (IMPS / NEFT / RTGS)**:
  - Account holder name
  - Indian bank account number (9–18 digits, non-zero)
  - 11-character Indian IFSC code (`^[A-Z]{4}0[A-Z0-9]{6}$`, 5th character must be `0`)
  - Optional bank / branch label

### Encryption & Privacy Invariants
- Full beneficiary names, UPI VPAs, bank account numbers, and IFSC codes are encrypted server-side using **AES-256-GCM** with a 32-byte key from `PAYOUT_DETAILS_ENCRYPTION_KEY`, a fresh 96-bit random IV, a 128-bit authentication tag, and Additional Authenticated Data (`zybble:payout-destination:v1:<creatorId>:<method>`) before storage in `creator_payout_destinations.encrypted_payload`.
- If `PAYOUT_DETAILS_ENCRYPTION_KEY` is missing, malformed, or all-zero, encryption and decryption **fail closed** (`PayoutCryptoError`).
- Column-level SQL privileges revoke `SELECT` on `creator_payout_destinations.encrypted_payload` and `payout_requests.destination_encrypted_payload` from `anon` and `authenticated`.
- Only masked display metadata (`masked_destination`, `masked_account_holder`, `bank_label`) is ever returned to Creator Studio pages, Admin list views, CSV exports, logs, or Resend emails.
- Saved destinations are labeled **"Details saved · Awaiting payout"** — Zybble never claims a bank account or UPI ID is "verified" merely because a form was saved.

---

## 3. Manual Payout Request & Admin Confirmation Lifecycle (`src/lib/server/payouts.ts`)

### Creator Balance Reconciliation

"Captured" is decided in SQL, not in TypeScript. `orders_own_read` is `user_id = auth.uid() or is_admin()`, so a creator reading their own `order_items` through the RLS client gets `null` for the embedded order and cannot distinguish a paid sale from an abandoned checkout — and a row-by-row read would stop at PostgREST's 1000-row limit anyway. Migration `20260101001100_creator_earnings_aggregates.sql` therefore provides four `security definer` aggregates (`creator_earnings_totals`, `creator_earnings_by_course`, `creator_earnings_daily`, `creator_earnings_monthly`) that join `orders` themselves, filter `o.status = 'paid'`, and scope to `auth.uid()`. They are granted to `authenticated` only: with `service_role` there is no `auth.uid()`, so a call would silently return zeros. If they cannot be read, `CreatorFinance.earningsAvailable` is `false` and Creator Studio says the earnings could not be read rather than displaying ₹0.

For each creator, `computeCreatorPayoutBalance()` then computes in integer paise from those captured totals and the creator's payout requests:
- `grossPaise`: sum of `unit_price_paise` on captured order items (`creator_earnings_totals`)
- `commissionPaise`: sum of `commission_paise` on captured order items
- `grossEarnedPaise`: sum of `creator_share_paise` on captured order items (`unit_price_paise = commission_paise + creator_share_paise` for every item)
- `legacyReversedPaise`: sum of `route_transfers.reversed_paise` for historical Razorpay Route transfers the provider reversed. This is **not** a refund — see §4.
- `netEarnedPaise = grossEarnedPaise - legacyReversedPaise`
- `paidOutPaise`: sum of `payout_requests.amount_paise` where `status = 'paid'` (plus any historical `route_settlements` where `status = 'processed'`)
- `reservedPendingPaise`: sum of `payout_requests.amount_paise` where `status in ('requested', 'approved')`; `rejected`, `failed` and `cancelled` release their reservation
- `unallocatedBalancePaise = netEarnedPaise - paidOutPaise - reservedPendingPaise`
- `availablePaise = Math.max(0, unallocatedBalancePaise)`
- `negativeAdjustmentPaise = Math.max(0, -unallocatedBalancePaise)`
- `outstandingPayablePaise = Math.max(0, netEarnedPaise - paidOutPaise)`

### State Machine (`payout_requests.status`)
Allowed transitions (enforced both in `src/lib/server/payouts.ts` and by the Postgres trigger `guard_payout_request_transition`):
- `requested -> approved | paid | rejected | failed | cancelled`
- `approved -> paid | rejected | failed`
- `paid`, `rejected`, `failed`, `cancelled` are terminal states for a request row.
- When a request transitions to `rejected`, `failed`, or `cancelled`, its reserved amount is immediately released back into `availablePaise` so the creator can update their destination and submit a fresh request.

### Atomic Request Reservation
- `requestCreatorPayout` invokes the Postgres RPC `create_creator_payout_request`, which locks the creator's `creator_profiles` row `FOR UPDATE`, recomputes available balance inside the transaction, snapshots the encrypted and masked destination onto `payout_requests`, and writes a `payout_requested` event to `payout_audit_events`. Concurrent requests cannot double-spend the same available balance.

### Admin Verification & Off-Platform Transfer (`/admin/payouts`)
1. **Audited Destination Reveal**: When an admin clicks **Reveal full destination**, `revealPayoutDestinationAction` (`noStore()`) verifies the admin session, decrypts the request's immutable destination snapshot, and writes an immutable `destination_revealed` event to `payout_audit_events` and `admin_audit_log`.
2. **Off-Platform Transfer**: The admin executes the UPI or bank transfer outside Zybble using Zybble's banking portal.
3. **Strict Paid Confirmation (`confirmManualPayoutPaidAction`)**: An admin cannot mark a payout `paid` with a single click. Both the server action and the database `CHECK` constraint require:
   - `payment_reference` (4–120 character bank UTR / IMPS / NEFT / UPI reference)
   - `payment_method_used` (`upi`, `bank_imps`, `bank_neft`, `bank_rtgs`, `bank_transfer`)
   - `confirmed_amount_matches = true` (and exact paise match against `amount_paise`)
   - `confirmed_transfer_sent = true`
4. **Ledger & Notification**: Marking a payout `paid` appends a `kind = 'payout'`, `direction = 'debit'` entry to `ledger_entries` for `creator:<creator_id>` with `external_ref = payment_reference`, records `payout_paid` in `payout_audit_events`, and emails the creator the UTR reference and masked destination.

---

## 4. Reversals & Post-Payout Adjustments (there is no refund flow)

Zybble has **no refund policy**. Nothing in the product offers a refund, the `refunds` table and its enums were dropped in `supabase/migrations/20260101000700_remove_refunds.sql`, and a captured creator share is never debited back by an admin action or a webhook.

**Ignored provider events.** `refund.created`, `refund.processed`, `refund.failed` and `payment.refunded` are acknowledged with HTTP 200 and recorded in `webhook_events` so Razorpay stops retrying, then dropped with a `console.warn`. If one arrives, an operator has issued a refund outside Zybble and must reconcile it by hand; the platform will not silently invent an accounting entry for money it did not move.

**What can still reduce a creator's earnings: a provider transfer reversal.** Historical Razorpay Route transfers (`route_transfers`) can be reversed by the provider. `applyTransferState()`:
  - re-fetches the authoritative transfer state from Razorpay before trusting the payload, and refuses to mark anything `processed` when the provider is unreachable;
  - writes `route_transfers.status` and `reversed_paise`;
  - for `reversed` / `partially_reversed`, appends an immutable `ledger_entries` row (`kind = 'reversal'`, `direction = 'debit'`, `account = 'creator:<creator_id>'`, idempotency key `transfer-reversal:<transferId>:<amountPaise>`);
  - revokes the entitlement that the reversed money bought (`entitlements.revoked_at`), because the access was paid for by funds that no longer exist.

**Post-payout honesty.** If a reversal lands after the creator has already been paid out manually, Zybble never pretends money was clawed back from the creator's bank account. `unallocatedBalancePaise` goes negative and surfaces as `negativeAdjustmentPaise` on both the Creator Studio earnings page and `/admin/payouts`, offsetting future course sales until recovered. The earnings page states the offset in plain language and never labels it a refund.

**Ledger kinds.** `ledger_entry_kind` is append-only, so the historical `'refund'` value still exists in the enum and in old rows; no code path writes it any more. New writes use `sale`, `commission`, `transfer`, `settlement`, `payout`, `reversal` or `adjustment`.
