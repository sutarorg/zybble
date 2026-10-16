# Launch Blockers

This document tracks regulatory, payment-provider, tax, and operational gates that must be cleared before enabling live payments (`rzp_live_...`) on Zybble.

---

## 1. Razorpay Marketplace / Master-Merchant Approval (Critical Legal & Provider Gate)

Zybble collects learner payments in INR through standard Razorpay Checkout into Zybble's merchant account and disburses creators' net earnings via manual Indian bank (NEFT/IMPS/RTGS) or UPI transfers.

**Why this is a launch gate under Razorpay's Terms of Use (`https://razorpay.com/terms/`):**
- **Own-Business / Approved Category Restriction (Part A, Clauses 2.14(1)–(3) & 14.7(iv)/(vi))**: A standard Razorpay merchant account is licensed solely for the merchant's own bona fide business activities in the category approved during onboarding and may not be used to collect payments on behalf of third-party sellers without marketplace approval.
- **E-Commerce Marketplace / Master Merchant Terms (Part A, Clause 2.22 & Part B, "Specific Terms for Payment Aggregators / E-Commerce Marketplaces Onboarded as Merchants", Clauses 1.14–1.17)**: To collect payments for courses sold by independent third-party creators ("Sub-Merchants"), Zybble must either:
  1. Be explicitly approved by Razorpay Payments Private Limited ("Razorpay PA", operating under RBI Payment Aggregator Master Directions dated Sept 15, 2025 `RBI/DPSS/2025-26/141`) as an **e-commerce marketplace / master merchant**, maintain contractual authorization from every creator to collect payments on their behalf, perform required sub-merchant due diligence, and indemnify Razorpay; **OR**
  2. Operate contractually and for tax/invoicing purposes as the **principal publisher / merchant of record** (licensing course content from instructors and paying royalties/service fees under Zybble's own approved education merchant category), confirmed in writing by legal counsel and Razorpay merchant compliance.
- **Note on Third-Party Settlement Turnover (Part A, Clause 14.2(4))**: Razorpay's ₹40 lakh annual domestic turnover (or ₹5 lakh export turnover) representation applies when asking Razorpay to settle Transaction Amounts directly to third parties. Switching from Razorpay Route to manual payouts removes the technical dependency on Route APIs, **but does not bypass the requirement that Zybble's merchant profile be approved by Razorpay for its actual marketplace/instructor payout model**.
- **Customer-Facing Checkout Policies (Part B, Clauses 6.1(ii) & 6.7)**: Razorpay requires clear display of terms of use and refund/cancellation policies (including timelines) prior to checkout.

**Zybble's current position on refunds, stated plainly.** The product has **no refund policy**: the policy page, every checkout, dashboard and support surface were removed, the `refunds` table and its enums were dropped (`20260101000700_remove_refunds.sql`), and `refund.*` / `payment.refunded` webhooks are acknowledged and ignored. Learners asking for one are directed to `/help` and `/messages`. That is a deliberate product decision, but it is **not** automatically the same thing as satisfying Clause 6.1(ii)/6.7 — Razorpay asks for a *published* refund/cancellation policy, and "we do not refund" is itself a policy that has to be displayed somewhere before checkout.

**Required action before switching to `rzp_live_` keys:**
- [ ] Obtain written confirmation from Razorpay Merchant Compliance approving Zybble's business category and creator payout model.
- [ ] Obtain written confirmation from Razorpay Merchant Compliance that a published no-refund / cancellation statement (linked from the checkout footer and `/terms`) satisfies Clauses 6.1(ii) and 6.7, and publish that statement. Until then, treat live-key activation as blocked.
- [ ] Decide and document the operational procedure for a refund issued *outside* Zybble (Razorpay dashboard or a chargeback): the platform will not create an accounting entry for money it did not move, so an operator must adjust the creator's balance manually and the `negativeAdjustmentPaise` offset is the mechanism that already exists for it.
- [ ] Keep only Razorpay test credentials (`rzp_test_...`) in all environments until written approval is on file.

---

## 2. Indian Tax, TDS (Section 194-O) & GST / TCS (Section 52) Sign-Off

Collecting full learner payments into Zybble's bank account and disbursing net creator earnings manually creates direct statutory tax and invoicing obligations in India:

1. **Income Tax Act, 1961 — Section 194-O (TDS on E-Commerce Participants)**
   - Razorpay Terms Part A Clause 3.6 explicitly states that the e-commerce operator (Zybble) is solely responsible for evaluating, deducting, depositing, and filing Section 194-O TDS; Razorpay does not deduct Section 194-O tax.
   - Under Finance (No. 2) Act 2024 (effective 1 October 2024), an e-commerce operator must deduct TDS at **0.1%** on the gross amount of sales facilitated for resident e-commerce participants (subject to the ₹5,00,000 annual exemption threshold for resident individuals/HUFs who have furnished a valid PAN/Aadhaar, or **5% under Section 206AA** if PAN/Aadhaar is not furnished).
   - **Action**: Confirm with a Chartered Accountant (CA) whether PAN collection and Section 194-O TDS deduction/Form 16A issuance must be enabled before paying creators whose annual gross sales approach ₹5,00,000 (or from the first rupee for non-individual creators or creators without PAN). Note: Zybble intentionally does not collect Aadhaar or identity-document uploads in the application unless and until legal counsel mandates a verified tax-ID workflow.

2. **CGST Act, 2017 — GST on Digital Educational Services, Commission & Section 52 TCS**
   - Determine with a CA whether Zybble acts as:
     - **E-commerce operator / agent**: collecting 18% GST on Zybble's marketplace commission (`commission_paise`) and evaluating **0.5% GST TCS under Section 52** on net taxable supplies made by GST-registered creators; or
     - **Principal supplier of online educational services (SAC 999299)**: charging 18% GST on the full course price (`unit_price_paise`) and paying creators against creator invoices/royalty statements.
   - **Action**: Finalize GSTIN registration, SAC codes, and tax-invoice generation before accepting live INR payments.

---

## 3. Production Infrastructure & Secrets Checklist

The application reports live configuration state at `/api/health` and `/admin/diagnostics`:

- [ ] **Supabase (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`)**: Apply all migrations in `supabase/migrations/` (`20260101000100_extensions_and_enums.sql` through `20260101001100_creator_earnings_aggregates.sql`) and seed the first administrator email in `public.platform_admins`.
- [ ] **Payout Encryption Key (`PAYOUT_DETAILS_ENCRYPTION_KEY`)**: Generate a cryptographically random 32-byte key (`openssl rand -hex 32`), store it in the production secret manager, and back it up securely. Without this key, saving and decrypting creator UPI/bank payout destinations fails closed.
- [ ] **Razorpay (`NEXT_PUBLIC_RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`)**: Configure webhook delivery to `https://<domain>/api/razorpay/webhook` for `payment.captured`, `payment.failed`, `order.paid`, `transfer.reversed`, `transfer.partially_reversed`, `settlement.processed`, and `settlement.failed`. Do not subscribe `refund.*` or `payment.refunded` — they are ignored by design. Keep test keys (`rzp_test_...`) until Blocker #1 and Blocker #2 are signed off.
- [ ] **Bunny Stream (`BUNNY_STREAM_LIBRARY_ID`, `BUNNY_STREAM_API_KEY`, `BUNNY_STREAM_CDN_HOSTNAME`, `BUNNY_STREAM_TOKEN_KEY`, `BUNNY_STREAM_WEBHOOK_SECRET`)**: Required for lesson video upload, encoding webhooks, and signed HLS playback.
- [ ] **Cloudflare R2 (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `NEXT_PUBLIC_R2_PUBLIC_BASE_URL`)**: Required for course thumbnails, avatars, and private downloadable course resources.
- [ ] **Resend (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`)**: Required to deliver the signup verification link (generated server-side, so Supabase SMTP is not needed), order receipts, course-update announcements, creator alerts, course moderation decisions, and manual payout lifecycle emails (`payout_requested`, `payout_approved`, `payout_paid`, `payout_rejected`, `payout_failed`). Every template is gated by a learner or creator email preference; see `DEPLOYMENT.md` §7.1.
- [ ] **OpenRouter (`OPENROUTER_API_KEY`, `OPENROUTER_MODEL`)**: Required for Zybble 2.0, the public course-discovery assistant. Without a key it says it is unavailable rather than guessing.

---

## 4. Operational Gates

- [ ] **Daily mail job.** There is no in-process scheduler. `POST /api/email/outbox` (moderator or admin session) both queues the scheduled learner mail and drains the outbox, so it must be called **daily** by an external timer — a Vercel Cron, a GitHub Action, or any scheduler that can present an authorised session. Weekly reports and catalogue digests are only queued on UTC Mondays, so a job that runs less often than daily silently drops them. See `DEPLOYMENT.md` §7.1 for the per-run bounds.
- [ ] **`course_events` retention.** Creator analytics keeps 365 days of windows, and impressions/views/watch-seconds rows accumulate with traffic. Nothing prunes them automatically. Run `select public.prune_course_events(<retention_days>);` as a scheduled SQL job (`service_role` only; default 420 days). Do **not** set retention below 365 days or the longest analytics window and its year-over-year comparison will start reporting less than a full period.
- [ ] **Third-party analytics consent.** `NEXT_PUBLIC_GA_MEASUREMENT_ID`, `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_SENTRY_DSN` are loaded only when set, but enabling them for real traffic requires a deny-by-default consent banner first. First-party Creator Studio analytics is unaffected — it uses no third-party script and is covered by the learner/creator email and tracking preferences already in the product.
- [ ] **Live-traffic rehearsal of the money path.** Static tests cannot prove RLS or provider behaviour. Before live keys: apply migrations to a real database and run the three-session RLS check in `DEPLOYMENT.md` §3.3, complete a test-mode checkout end to end (order → Razorpay → webhook → entitlement → receipt → creator balance), confirm a forged webhook signature is rejected, and confirm `/checkout/success` grants nothing on its own.
