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
     3. Handles `payment.captured`, `order.paid`, `payment.failed`, `refund.created`, and `refund.processed` in any delivery order.
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
For each creator, `computeCreatorPayoutBalance()` computes in integer paise:
- `grossPaise`: sum of `unit_price_paise` on captured orders (`paid`, `partially_refunded`, `refunded`)
- `commissionPaise`: sum of `commission_paise` on captured orders
- `grossEarnedPaise`: sum of `creator_share_paise` on captured orders
- `refundedCreatorSharePaise`: sum of proportional creator-share debits across processed `refunds`
- `netEarnedPaise = grossEarnedPaise - refundedCreatorSharePaise`
- `paidOutPaise`: sum of `payout_requests.amount_paise` where `status = 'paid'` (plus any historical `route_settlements` where `status = 'processed'`)
- `reservedPendingPaise`: sum of `payout_requests.amount_paise` where `status in ('requested', 'approved')`
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

## 4. Refunds, Reversals & Post-Payout Adjustments

- When an admin initiates a refund (`refundOrder`) or Razorpay sends a `refund.processed` webhook (`reconcileProviderReversal`):
  - `computeCreatorRefundAdjustmentPaise()` splits the refund proportionally between the creator's share (`creatorRefundDebitPaise`) and Zybble's commission (`commissionReversalPaise`) so `creatorRefundDebitPaise + commissionReversalPaise === refundAmountPaise`.
  - `ledger_entries` records both the platform refund debit (`kind = 'refund'`) and the creator's proportional share debit (`kind = 'adjustment'`, `direction = 'debit'`, `account = 'creator:<creator_id>'`).
  - **If the creator has not yet been paid out**, the refund debit immediately reduces `netEarnedPaise` and `availablePaise`.
  - **If the creator was already paid out manually**, Zybble never pretends money was automatically clawed back from the creator's bank account. Instead, `unallocatedBalancePaise` becomes negative and surfaces as `negativeAdjustmentPaise` on both the Creator Studio and Admin Payouts portals, offsetting future course sales until recovered.
