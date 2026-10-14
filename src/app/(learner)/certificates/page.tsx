import type { Metadata } from "next";
import Link from "next/link";
import { Award, BadgeCheck, Download } from "lucide-react";
import { getCertificates } from "@/lib/server/learner";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Certificates",
  description: "Certificates for every Zybble course you have completed.",
};

export const dynamic = "force-dynamic";

export default async function CertificatesPage() {
  const certificates = await getCertificates();

  return (
    <div className="space-y-6 px-4 py-7 sm:px-6 lg:px-9">
      <header>
        <h1 className="font-display text-[26px] leading-tight font-bold tracking-tight">Certificates</h1>
        <p className="mt-1.5 text-[14px] text-muted-foreground">
          A certificate is issued the moment every lesson of a course is marked complete. Completion is computed
          from your stored lesson progress, so it cannot be claimed from the browser.
        </p>
      </header>

      {certificates.length === 0 ? (
        <EmptyState
          icon={Award}
          title="No certificates yet"
          description="Finish every lesson in one of your courses and Zybble will issue a certificate with a unique verification code."
          action={
            <Button asChild>
              <Link href="/my-learning">Go to my learning</Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {certificates.map((certificate) => (
            <li key={certificate.id}>
              <article className="h-full rounded-xl border border-border bg-white p-6 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold tracking-[0.16em] text-primary uppercase">
                      Certificate of completion
                    </p>
                    <h2 className="font-display mt-1.5 text-[18px] leading-snug font-bold tracking-tight">
                      {certificate.courseTitle}
                    </h2>
                  </div>
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
                    <Award className="size-5.5" aria-hidden />
                  </span>
                </div>

                <p className="mt-4 text-[13px] text-muted-foreground">Awarded to</p>
                <p className="font-display text-[16px] font-semibold">{certificate.studentName}</p>

                <dl className="mt-4 grid grid-cols-2 gap-3 text-[12.5px]">
                  <div>
                    <dt className="text-muted-foreground">Lessons completed</dt>
                    <dd className="font-medium tabular-nums">{certificate.lessonsCount}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Course length</dt>
                    <dd className="font-medium tabular-nums">{certificate.durationMinutes} min</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Issued</dt>
                    <dd className="font-medium">{new Date(certificate.issuedAt).toLocaleDateString("en-IN")}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Verification code</dt>
                    <dd className="font-mono text-[11.5px] font-medium">{certificate.verificationCode}</dd>
                  </div>
                </dl>

                <p className="mt-4 flex items-start gap-1.5 text-[11.5px] text-zinc-400">
                  <BadgeCheck className="mt-px size-3.5 shrink-0" aria-hidden />
                  Zybble certificates record completion on this platform. They are not an academic qualification
                  and carry no accreditation.
                </p>
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}