import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { InfoPage, LegalNote, LegalSection, LegalList } from "@/components/layout/info-page";

export const metadata: Metadata = {
  title: "Refund Policy",
  description: "Zybble's 30-day money-back guarantee and refund process.",
};

export default function RefundPolicyPage() {
  return (
    <InfoPage
      label="Legal"
      title="Refund Policy"
      description="Every paid course is covered by our 30-day money-back guarantee. If it isn't right for you, we'll make it right."
      updated="January 15, 2026"
    >
      <div className="mt-8 flex items-start gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
        <ShieldCheck className="mt-0.5 size-6 shrink-0 text-emerald-600" aria-hidden />
        <div>
          <p className="font-display text-[16px] font-semibold text-emerald-950">
            The short version
          </p>
          <p className="mt-1 max-w-2xl text-[14px] leading-relaxed text-emerald-900/80">
            Request a refund within 30 days of purchase, and you'll get your money back — full
            amount, original payment method, usually within 5–10 business days. In this demo,
            purchases are simulated and no money ever moves.
          </p>
        </div>
      </div>

      <LegalNote>
        This is a sample document provided for the frontend demo. It is illustrative only and is
        not legal advice.
      </LegalNote>

      <div className="max-w-3xl">
        <LegalSection index={1} title="Eligibility">
          <LegalList
            items={[
              "All paid courses are refundable within 30 days of the purchase date.",
              "Free courses require no refunds — unenroll any time.",
              "Bundles are refundable as a whole, not per individual course.",
              "Gift purchases are refundable to the original purchaser only.",
            ]}
          />
        </LegalSection>

        <LegalSection index={2} title="How to request a refund">
          <p>
            Open the course in My Learning, choose "Request refund" from the course menu, and tell
            us briefly what went wrong (optional — it helps us improve). Approved refunds are
            issued to the original payment method. In this demo, the flow is simulated from the
            Help Center.
          </p>
        </LegalSection>

        <LegalSection index={3} title="Timing">
          <LegalList
            items={[
              "Approval: usually within 24 hours.",
              "Card refunds: 5–10 business days depending on your bank.",
              "PayPal and wallet refunds: typically within 48 hours.",
              "You'll receive an email confirmation at every step.",
            ]}
          />
        </LegalSection>

        <LegalSection index={4} title="Fair use">
          <p>
            Our guarantee exists so you can try courses without risk. To protect instructors, we
            may decline refunds in cases of clear abuse — for example, repeatedly completing entire
            courses before refunding, or a pattern of refunding every purchase. We'll always
            explain our decision and you can appeal it.
          </p>
        </LegalSection>

        <LegalSection index={5} title="After a refund">
          <p>
            Refunded courses are removed from your library and certificates are revoked. Your
            account and other courses are unaffected, and you're welcome back to the course any
            time at its current price.
          </p>
        </LegalSection>

        <LegalSection index={6} title="Questions">
          <p>
            Billing questions are answered in the Help Center, or message support directly — in
            this demo, from the Messages page.
          </p>
        </LegalSection>
      </div>
    </InfoPage>
  );
}
