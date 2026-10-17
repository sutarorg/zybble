import { notFound } from "next/navigation";
import { getCreatorCourse, getCreatorResources } from "@/lib/server/creator";
import { paiseToRupees } from "@/lib/money";
import { StatusBadge } from "@/components/creator/status-badge";
import { PricingForm } from "./pricing-form";
import { ResourceManager, type ResourceItem } from "./resource-manager";

export const metadata = { title: "Pricing & Resources" };
export const dynamic = "force-dynamic";

export default async function CourseContentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [course, rawResources] = await Promise.all([
    getCreatorCourse(id),
    getCreatorResources(id),
  ]);
  if (!course) notFound();

  const items: ResourceItem[] = rawResources.map((r) => ({
    id: String(r.id),
    lessonId: r.lesson_id ? String(r.lesson_id) : null,
    title: String(r.title ?? r.file_name ?? "Resource"),
    fileName: String(r.file_name ?? "file"),
    contentType: String(r.content_type ?? "application/octet-stream"),
    sizeBytes: Number(r.size_bytes ?? 0),
  }));

  const locked = course.status === "published";

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] leading-tight font-bold tracking-tight">
            Pricing
          </h1>
          <p className="mt-1.5 text-[14px] text-muted-foreground">
            {course.title} · set your enrollment price in INR and attach any course-wide worksheets or files.
          </p>
        </div>
        <StatusBadge status={course.status} />
      </header>

      <PricingForm
        locked={locked}
        initial={{
          id: course.id,
          thumbnailKey: course.thumbnailKey,
          title: course.title,
          subtitle: course.subtitle,
          description: course.description,
          categorySlug: course.categorySlug ?? "",
          level: (["beginner", "intermediate", "advanced"].includes(
            course.level
          )
            ? course.level
            : "beginner") as "beginner" | "intermediate" | "advanced",
          language: course.language,
          priceRupees: paiseToRupees(course.pricePaise),
          compareAtRupees:
            course.compareAtPaise > 0
              ? paiseToRupees(course.compareAtPaise)
              : "",
          whatYouLearn: course.whatYouLearn,
          requirements: course.requirements,
          audience: course.audience,
        }}
      />

      <ResourceManager
        courseId={course.id}
        editable={!locked}
        items={items}
      />
    </div>
  );
}
