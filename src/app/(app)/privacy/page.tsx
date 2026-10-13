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
      updated="January 15, 2026"
    >
      <LegalNote>
        This demo stores all data locally in your browser (localStorage) — nothing is transmitted
        to any server. This sample policy describes how the production product would handle data.
      </LegalNote>

      <div className="max-w-3xl">
        <LegalSection index={1} title="Information we collect">
          <LegalList
            items={[
              "Account data: name, email, password (hashed) and profile preferences.",
              "Learning data: enrollments, lesson progress, quiz results and issued certificates.",
              "Payment data: processed by our payment provider; we store only the last four digits and billing country.",
              "Usage data: pages visited, search queries and feature interactions (with consent).",
            ]}
          />
        </LegalSection>

        <LegalSection index={2} title="How we use information">
          <LegalList
            items={[
              "Provide and personalize your learning experience, including recommendations.",
              "Process orders, issue receipts and handle refunds.",
              "Communicate product updates, price drops and learning reminders (opt-out any time).",
              "Detect abuse, secure the platform and comply with legal obligations.",
            ]}
          />
        </LegalSection>

        <LegalSection index={3} title="Certificates">
          <p>
            When you complete a course we generate a certificate containing your name, the course
            title, the instructor&apos;s name, the issue date and a verification code. In this demo
            the certificate is rendered in your browser and stored only on your device; a
            production build would also keep a server-side record so the code can be verified
            publicly.
          </p>
        </LegalSection>

        <LegalSection index={4} title="Sharing">
          <p>
            We share data only with the processors needed to run Zybble (hosting, payments,
            analytics, AI inference) under data-processing agreements, and when required by law. We
            do not sell personal data. Instructors see aggregated, anonymized statistics about
            their courses — not identifiable learner data, except when you post a review or
            comment.
          </p>
        </LegalSection>

        <LegalSection index={5} title="Your rights">
          <LegalList
            items={[
              "Access, correct or delete your account data at any time in Settings.",
              "Export your learning history in a machine-readable format.",
              "Opt out of marketing emails with one click.",
              "Depending on your region (GDPR, CCPA and similar), you may have additional rights — contact us to exercise them.",
            ]}
          />
        </LegalSection>

        <LegalSection index={6} title="Retention and security">
          <p>
            We retain account data while your account is active and for 24 months afterwards unless
            law requires longer. Data is encrypted in transit and at rest; access within Zybble is
            limited to staff who need it to operate the service.
          </p>
        </LegalSection>

        <LegalSection index={7} title="Cookies">
          <p>
            We use strictly necessary cookies (sign-in, security), preference cookies (language,
            theme) and — with consent — analytics cookies. You can manage consent at any time from
            the footer link. In this demo, equivalents are stored in localStorage.
          </p>
        </LegalSection>

        <LegalSection index={8} title="Changes and contact">
          <p>
            We will post material changes here at least 14 days before they take effect and notify
            you by email where required. Privacy questions go to our Help Center; in this demo, all
            contact flows are simulated.
          </p>
        </LegalSection>
      </div>
    </InfoPage>
  );
}
