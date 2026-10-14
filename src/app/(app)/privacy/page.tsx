import { LocalizedText } from "@/components/providers/localized-text";
import type { Metadata } from "next";
import { InfoPage, LegalNote, LegalSection, LegalList } from "@/components/layout/info-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Zybble collects, uses and protects your information.",
};

export default function PrivacyPage() {
  return (
    <InfoPage
      label="Legal"
      title="Privacy Policy"
      description="How we collect, use and protect your information across the Zybble marketplace."
      updated="October 14, 2026"
    >
      <LegalNote>
        <LocalizedText text={"Zybble is an India-only marketplace. Accounts, learning records, orders and certificates are stored on Zybble servers, not in your browser. This policy describes the system as built; items still marked as unresolved are listed in the launch documentation and reviewed before public launch."} />
      </LegalNote>

      <div className="max-w-3xl">
        <LegalSection index={1} title="Information we collect">
          <LegalList
            items={[
              "Account data: name, email, a hashed password, language and study preferences. Passwords are hashed by Supabase Auth and are never readable by Zybble.",
              "Learning data: enrolments, lesson progress, lesson notes, resume position and issued certificates.",
              "Order data: INR amounts in paise, order and payment references, and the creator share and platform commission recorded at the time of purchase.",
              "Payment data: processed entirely by Razorpay. Zybble stores a masked method descriptor (for example “UPI” or “Card”) and Razorpay's own payment reference — never a card number, UPI PIN or bank credential.",
              "Creator data: the profile, bio and teaching topics a creator publishes, plus the Razorpay Route account status Razorpay reports.",
              "Usage data: page views, search queries and feature interactions, collected only when analytics keys are configured and only with your consent.",
            ]}
          />
        </LegalSection>

        <LegalSection index={2} title="How we use information">
          <LegalList
            items={[
              "Provide and personalise your learning experience.",
              "Create orders, grant access after a verified payment, and issue receipts.",
              "Send transactional email through Resend — receipts, password resets and account notices.",
              "Send course updates and study reminders you have opted into. Marketing email is off by default and one click unsubscribes.",
              "Detect abuse, secure the platform, and comply with legal obligations.",
            ]}
          />
        </LegalSection>

        <LegalSection index={3} title="Certificates">
          <p>
            <LocalizedText text={"When you complete every lesson of a course, Zybble issues a certificate containing your name, the course title, the instructor's name, the lesson count and a verification code. The certificate is a server-side record tied to your account — it is not generated in your browser, and a code cannot be created by editing a page."} />
          </p>
        </LegalSection>

        <LegalSection index={4} title="Sharing">
          <p>
            <LocalizedText text={"Zybble shares data only with the processors needed to run the service — hosting and database (Supabase on Vercel), video hosting and processing (Bunny Stream), private file storage (Cloudflare R2), payments and payouts (Razorpay), transactional email (Resend) and course-discovery AI inference (OpenRouter) — and when required by law. We do not sell personal data. Creators see aggregated course statistics, not identifiable learner data, except when you post a review or message them."} />
          </p>
        </LegalSection>

        <LegalSection index={5} title="Your rights">
          <LegalList
            items={[
              "Update your name and email in Settings at any time.",
              "Close your account from Settings. Closure requests are recorded and acted on server-side; there is no “delete everything” button that silently drops local data.",
              "Opt out of non-essential email in Settings.",
              "Under the Digital Personal Data Protection Act, 2023 you may request access to, correction of, or erasure of your personal data. Write to us and we will respond within the statutory period.",
            ]}
          />
        </LegalSection>

        <LegalSection index={6} title="Retention and security">
          <p>
            <LocalizedText text={"Data is encrypted in transit. Authorization is enforced on the server and in the database: every learner table is scoped by row-level security to your own user id, so a request from the browser cannot read another account's data. Access to the service role key is server-only and is never sent to a browser, an analytics event or a log line."} />
          </p>
        </LegalSection>

        <LegalSection index={7} title="Cookies">
          <p>
            <LocalizedText text={"Zybble uses a strictly necessary cookie to hold your Supabase session, plus a preference cookie for language. Analytics (GA4, PostHog, Sentry) only load when their keys are configured; no analytics script is included otherwise. The chatbot sends only the text you type, never account data."} />
          </p>
        </LegalSection>

        <LegalSection index={8} title="Refunds">
          <p>
            <LocalizedText text={"The Zybble marketplace publishes no refund policy and offers no refund flow. If a payment is reversed by your bank or by Razorpay, the financial ledger is corrected automatically and the corresponding access ends. That is an accounting correction, not a customer refund promise."} />
          </p>
        </LegalSection>

        <LegalSection index={9} title="Changes and contact">
          <p>
            <LocalizedText text={"Material changes to this policy are announced in the product and by email before they take effect. Privacy questions go to the Help Center."} />
          </p>
        </LegalSection>
      </div>
    </InfoPage>
  );
}