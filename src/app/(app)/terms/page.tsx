import { LocalizedText } from "@/components/providers/localized-text";
import type { Metadata } from "next";
import { InfoPage, LegalNote, LegalSection, LegalList } from "@/components/layout/info-page";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that govern use of the Zybble marketplace.",
};

export default function TermsPage() {
  return (
    <InfoPage
      label="Legal"
      title="Terms of Service"
      description="These terms govern your access to and use of Zybble, including courses, certificates and related services."
      updated="January 15, 2026"
    >
      <LegalNote>
        <LocalizedText text={"This document states the terms the platform is built to enforce. The commission rate, tax treatment and commercial terms remain under review and are recorded in the launch documentation before public launch; nothing here is legal advice."} />
      </LegalNote>

      <div className="max-w-3xl">
        <LegalSection index={1} title="Acceptance of terms">
          <p><LocalizedText text={"By creating an account, browsing courses or completing a purchase on Zybble, you agree to these Terms of Service and our Privacy Policy. If you do not agree, you may not use the platform."} /></p>
        </LegalSection>

        <LegalSection index={2} title="Accounts">
          <p><LocalizedText text={"You are responsible for your account and everything that happens under it."} /></p>
          <LegalList
            items={[
              "You must provide accurate registration information and keep it current.",
              "You must be at least 16 years old, or have a guardian's consent.",
              "You may not share your account, sell access to it, or use another person's account.",
              "Notify us promptly if you suspect unauthorized access.",
            ]}
          />
        </LegalSection>

        <LegalSection index={3} title="Course access and licenses">
          <p><LocalizedText text={"When you enroll in a course, Zybble grants you a limited, non-exclusive, non-transferable license to view the content for personal, non-commercial learning. You may not download (except where explicitly offered), redistribute, resell, publicly perform or create derivative works from course content without written permission."} /></p>
          <p><LocalizedText text={"\"Lifetime access\" means for the lifetime of the course on the platform. If a course is retired, enrolled students keep access for at least 12 additional months wherever technically possible."} /></p>
        </LegalSection>

        <LegalSection index={4} title="Payments and pricing">
          <LegalList
            items={[
              "All prices are displayed in Indian Rupees (INR, \u20b9) and are charged in INR through Razorpay. Zybble is an India-only marketplace and does not offer any other currency.",
              "Promotional prices are time-limited and apply at the time of purchase only.",
              "You authorize us to charge your selected payment method for each order.",
            ]}
          />
        </LegalSection>

        <LegalSection index={5} title="Acceptable use">
          <p><LocalizedText text={"You agree not to:"} /></p>
          <LegalList
            items={[
              "Scrape, crawl or bulk-download platform content or user data.",
              "Forge, resell or misrepresent a Zybble certificate of completion.",
              "Interfere with the platform's security, availability or integrity.",
              "Post false reviews or manipulate ratings.",
              "Infringe intellectual-property rights of Zybble, instructors or third parties.",
            ]}
          />
        </LegalSection>

        <LegalSection index={6} title="Intellectual property">
          <p><LocalizedText text={"Zybble and its instructors retain all rights to the platform and course content, including videos, resources, branding and curriculum. Instructors grant Zybble a license to distribute their courses; learners receive the limited license described in Section 3."} /></p>
        </LegalSection>

        <LegalSection index={7} title="Disclaimer and liability">
          <p><LocalizedText text={"The platform is provided \"as is\" without warranties of any kind. Educational outcomes depend on your effort; we do not guarantee employment, income or certification outside of Zybble-issued certificates. To the maximum extent permitted by law, Zybble's aggregate liability is limited to the amount you paid in the 12 months preceding the claim."} /></p>
        </LegalSection>

        <LegalSection index={8} title="Changes to these terms">
          <p><LocalizedText text={"We may update these terms from time to time. Material changes will be announced at least 14 days in advance. Continued use after the effective date constitutes acceptance."} /></p>
        </LegalSection>

        <LegalSection index={9} title="Contact">
          <p><LocalizedText text={"Questions about these terms? Reach us through the Help Center or the Messages page; a message is stored as a real conversation on your account and answered by the Zybble team."} /></p>
        </LegalSection>
      </div>
    </InfoPage>
  );
}
