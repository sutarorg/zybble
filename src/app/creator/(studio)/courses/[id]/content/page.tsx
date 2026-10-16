import { notFound } from "next/navigation";
import { getCreatorCourse } from "@/lib/server/creator";
import { paiseToRupees } from "@/lib/money";
import { StatusBadge } from "@/components/creator/status-badge";
import { PricingForm } from "./pricing-form";

export const metadata = { title: "Pricing" };
export const dynamic = "force-dynamic";

export default async function CourseContentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const course = await getCreatorCourse(id);
  if (!course) notFound();
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] leading-tight font-bold tracking-tight">Pricing</h1>
          <p className="mt-1.5 text-[14px] text-muted-foreground">{course.title}</p>
        </div>
        <StatusBadge status={course.status} />
      </header>
      <PricingForm
        locked={course.status === "published"}
        initial={{
          id: course.id,
          thumbnailKey: course.thumbnailKey,
          title: course.title,
          subtitle: course.subtitle,
          description: course.description,
          categorySlug: course.categorySlug ?? "",
          level: (["beginner", "intermediate", "advanced"].includes(course.level) ? course.level : "beginner") as "beginner" | "intermediate" | "advanced",
          language: course.language,
          priceRupees: paiseToRupees(course.pricePaise),
          compareAtRupees: course.compareAtPaise > 0 ? paiseToRupees(course.compareAtPaise) : "",
          whatYouLearn: course.whatYouLearn,
          requirements: course.requirements,
          audience: course.audience,
        }}
      />
    </div>
  );
}
