# Zybble — Payment Flow

How a rupee moves from a learner to a creator, and every point at which Zybble
refuses to assume something it has not verified.

The short version:

> **A redirect grants nothing.** Access is created only from payment state that
> Razorpay has confirmed — either a verified webhook, or a server-side API fetch
> that proves the payment exists and was captured.

---

## 0. Ground rules

| Rule | Implementation |
| --- | --- |
| INR is the only currency | `CURRENCY = "INR"` in `src/lib/money.ts`; `assertInr()` rejects anything else at type, schema and runtime layers |
| Money is integer paise | Every stored, transmitted and split amount is an integer number of paise. Rupee strings convert decimal-safely; floats are never the source of truth |
| Commission is server-side | `marketplace_settings.commission_bps`. Nothing in the browser can set it |
| Commission is snapshotted | `commission_bps`, `commission_paise` and `creator_share_paise` are copied onto the **order item** at purchase. Changing the rate later never rewrites a past sale |
| The browser is untrusted | Price, commission, creator share and currency are read from the database on every call. The request body carries identifiers only |
| No refund policy | The marketplace has none and implements none. Provider reversals are accounting corrections |
| Transfer state comes from Razorpay | Nothing marks a transfer settled on its own |

---

## 1. Eligibility — paid checkout is refused when it cannot be settled

`assertPurchasable()` in `src/lib/server/checkout.ts` runs **before** any money
moves. It throws unless **all** of these hold:

1. The course exists and `status = 'published'`.
2. The course has a `creator_profiles` row.
3. **If the price > 0:** Razorpay reports the creator's Route linked account as
   `active` (`isRouteAccountEligible`). A creator who cannot be paid cannot be
   sold.
4. The learner does not already hold an active entitlement.

The same three server-side gates also block publication, so an ineligible paid
course never reaches a buyer in the first place:

- `submitCourseForReview()` — `src/app/creator/actions.ts`
- `approveCourse()` — `src/app/admin/actions.ts`
- `createCheckoutOrder()` — re-checks, so a race between the pre-check and the
  write cannot produce a purchasable-but-ineligible order

The course page renders the same verdict (`getCourseViewerState()` in
`src/lib/server/catalog.ts`) so the buyer sees *why* before clicking, rather
than a failure after.

---

## 2. Purchase

```
Browser                Zybble server                 Razorpay
   │                        │                            │
   │ POST /api/checkout     │                            │
   │ {courseId, mode:"auto"}│                            │
   ├───────────────────────►│                            │
   │                        │ assertPurchasable()        │
   │                        │ splitCommission(paise,bps) │
   │                        │ INSERT orders (pending)    │
   │                        │ INSERT order_items         │
   │                        │   + snapshot of price,     │
   │                        │     commission, creator    │
   │                        │     share, route_account_id│
   │                        │                            │
   │                        │ POST /v1/orders            │
   │                        │ {amount, currency:"INR",   │
   │                        │  transfers:[{account,     │
   │                        │             amount}]}      │
   │                        ├───────────────────────────►│
   │                        │ {id: order_xxx, amount}    │
   │                        │◄───────────────────────────┤
   │                        │ record razorpay_order_id   │
   │ ◄──────────────────────┤                            │
   │ {razorpayOrderId,      │                            │
   │  amountPaise, keyId,   │                            │
   │  checkoutOptions}      │                            │
   │                        │                            │
   │ open Razorpay Checkout.js (public key id only)       │
   │ ───────────────────────────────────────────────────►│
   │                        │        learner authenticates and pays
   │ ◄──────────────────────────────────────────────────│
   │ razorpay_order_id       │                            │
   │ razorpay_payment_id     │                            │
   │ razorpay_signature      │                            │
   │                        │                            │
   │ POST /api/checkout      │                            │
   │ {publicOrderId, ...sig} │                            │
   ├───────────────────────►│                            │
```

### 2a. The split

`splitCommission(grossPaise, commissionBps)` returns three integers:

```
commission_paise = floor(gross_paise × commission_bps / 10_000)
creator_paise    = gross_paise − commission_paise
```

The creator share is defined as the remainder, so the two halves **always sum
back to the gross exactly** — no rounding drift, ever. This is asserted in
`tests/money.mjs` across every rate in range against a sweep of amounts.

The Route transfer is attached to the Razorpay order itself
(`transfers: [{ account, amount }]`), so Razorpay performs the split
atomically with the capture rather than Zybble moving money afterwards.

**1000 bps = 10%** is a *planned default* only. It is stored in
`marketplace_settings.commission_bps` and is **snapshotted onto the order item
at purchase time**. No tax, fee or TDS treatment is applied or invented: the
`fee` and `tax` Razorpay reports on a payment are stored verbatim as observed
values. The commercial terms are still open — see `LAUNCH_BLOCKERS.md` §3.

---

## 3. Confirmation — the part that must not be faked

`confirmCheckout()` in `src/lib/server/checkout.ts` performs **two independent
proofs**, in order:

| # | Proof | What it rules out |
| --- | --- | --- |
| 1 | HMAC-SHA256 of `razorpay_order_id \| razorpay_payment_id` against `RAZORPAY_KEY_SECRET` | A hand-crafted or replayed browser response |
| 2 | `GET /v1/payments/{id}` — Razorpay says the payment exists, belongs to **this** order, is **INR**, is the **exact** paise amount, and its status is `captured` or `authorized` | A valid signature over a payment that was never made, or was made for a different order or amount |

Then, and only then:

1. The order transitions `pending → paid` with `paid_at`.
2. `entitlements` gets a row (idempotent — a replay cannot double-grant).
3. `ledger_entries` gets its rows (idempotent on `idempotency_key`).
4. `students_count` is recomputed from real entitlement rows, not incremented by
   a client-supplied number.
5. The purchase receipt is **queued** in `email_outbox` with
   `idempotency_key = purchase_confirmation:<orderId>` — so a replayed webhook
   can never send two receipts.
6. Any Route transfer Razorpay already created is recorded in
   `route_transfers` with its real `transfer_id` and status `created`.

If any step fails, the request fails. **The success page is cosmetic.**

---

## 4. Webhooks — the durable path

`POST /api/razorpay/webhook`

- The body is read as **text** before any parsing. Parsing and re-serialising
  changes the bytes and breaks the HMAC.
- `X-Razorpay-Signature` is verified against the **exact raw body** with
  `RAZORPAY_WEBHOOK_SECRET`.
- `X-Razorpay-Event-Id` is stored under a **unique constraint**. That constraint,
  not application logic, is what makes a replay a no-op.
- Events that are deliberately not acted on still return `200`, so Razorpay
  stops retrying them.
- Errors log the **event type only** — never the payload, which contains PII.

Handled events:

| Event | Effect |
| --- | --- |
| `payment.captured` | `applyCapturedPayment()` — the same idempotent path as the browser confirmation |
| `payment.failed` | Order marked failed |
| `order.paid` | Reconciliation sweep for any order not yet settled |
| `refund.processed` | Entitlement revoked, ledger reversed, `payment_reversed` email queued |

**Event ordering is not assumed.** A `payment.captured` that arrives before its
`order.paid`, or a duplicate of either, converges on the same terminal state.

---

## 5. Entitlement

An entitlement row exists only if:

1. A payment was verified as captured **by the server**, and
2. The learner id and course id came from the verified session and the order,
   not from the request.

Every consumer then enforces it again:

| Surface | Enforcement |
| --- | --- |
| Lesson player | `getLearningCourse()` returns `null` without an entitlement or preview access |
| Video playback | `POST /api/learn/[lessonId]/playback` checks entitlement **or** the lesson's `is_preview` flag on a published course, then issues a short-lived Bunny token |
| Resources | `POST /api/storage {action:"download"}` verifies entitlement before minting a pre-signed R2 URL |
| Progress / notes | `setLessonProgress()` and `saveLessonNote()` re-check the session and the lesson's course |
| Certificates | `issueCertificateIfComplete()` recomputes completion from persisted `lesson_progress` rows against the authoritative lesson list |

Navigating to `/checkout/success` by hand shows the "still confirming" state. It
creates nothing.

---

## 6. Transfers

Route transfer state is whatever Razorpay says it is.

| State | Source | Displayed as |
| --- | --- | --- |
| `created` | Recorded when Razorpay returns a transfer id at capture | "Transfer initiated" |
| `processed` | Razorpay transfer API / `transfer.processed` webhook | "Processed" |
| `settled` | Razorpay transfer API / `transfer.settled` webhook | "Settled in your bank account" |
| `failed` / `reversed` | Provider webhook | The provider's reason, verbatim |

`processed` and `settled` are different states and the UI keeps them apart:
**processed has not yet reached the bank.** No code path marks a transfer
settled without Razorpay having reported it.

Every transfer also writes a `ledger_entries` row keyed
`transfer-created:<transferId>` / `transfer-status:<transferId>:<status>`, so a
repeat event cannot double-credit a creator.

---

## 7. Reversals, disputes and refunds

**Zybble publishes no refund policy and implements no refund flow.** Do not add
one without the commercial decision recorded in `LAUNCH_BLOCKERS.md` §3.

What does exist is accounting correctness for provider-initiated events:

| Provider event | Zybble's response |
| --- | --- |
| `refund.processed` | Entitlement revoked, ledger reversed, course counters recomputed, `payment_reversed` email queued (subject: "Payment reversed") |
| Route transfer reversed | Creator's ledger entry reversed with an explicit reason from Razorpay |
| Dispute raised | Recorded against the payment with Razorpay's state |

The email says plainly that this is *a correction to Zybble's accounting
record, not a refund Zybble issued*. That wording is deliberate.

---

## 8. Free courses

Free enrolment never touches a payment provider.

`POST /api/checkout {mode:"free"}` re-runs `assertPurchasable()`, inserts a
`₹0` order and item with `commission_bps = 0`, and grants an entitlement
server-side. `/checkout/success` reports it honestly with no Razorpay reference
at all.

---

## 9. Idempotency map

| Operation | Guard |
| --- | --- |
| Webhook replay | unique `webhook_events.event_id` |
| Ledger write | unique `ledger_entries.idempotency_key` |
| Entitlement | `grantEntitlement()` upsert scoped to `(user_id, course_id)` |
| Receipt email | unique `email_outbox.idempotency_key` |
| Transfer ledger | `transfer-created:<id>` / `transfer-status:<id>:<status>` |
| Browser double-click | `confirmCheckout()` returns success for an already-`paid` order without re-applying |
| Request abuse | per-user and per-IP rate limits on checkout, webhooks, chat, uploads and downloads |

---

## 10. Verifying this yourself

With real Razorpay **test mode** credentials configured, the following is the
manual acceptance pass. **None of it has been run yet** — see
`LAUNCH_BLOCKERS.md` §4.

1. Free course → enrol → confirm an entitlement row exists and no Razorpay order
   was created.
2. Paid course with an inactive Route account → confirm checkout returns `409
   creator_not_payable`.
3. Paid course with an active Route account → create order → pay with a Razorpay
   test card/UPI → confirm the order is `paid`, an entitlement exists, a ledger
   entry exists, and exactly one receipt email was queued.
4. Replay the `payment.captured` webhook → confirm **no** second entitlement, no
   second ledger entry and no second email.
5. Reorder the webhook events → confirm the state converges.
6. Hand-craft `/checkout/success?order=...` → confirm nothing is granted.
7. Confirm the Route transfer appears in Razorpay's dashboard with the same
   amount Zybble recorded, and that `settled` only appears after Razorpay
   reports it.