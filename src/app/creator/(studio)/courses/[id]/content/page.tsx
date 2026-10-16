import { notFound } from "next/navigation";
import { getCreatorCourse, getCreatorResources } from "@/lib/server/creator";
import { ResourceManager, type CourseResource } from "./resource-manager";
import { StatusBadge } from "@/components/creator/status-badge";

export const metadata = { title: "Thumbnail & resources" };
export const dynamic = "force-dynamic";

export default async function CourseContentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [course, raw] = await Promise.all([getCreatorCourse(id), getCreatorResources(id)]);
  if (!course) notFound();

  const resources: CourseResource[] = raw.map((row) => ({
    id: String(row.id),
    title: String(row.title),
    fileName: (row.file_name as string) ?? "",
    contentType: (row.content_type as string) ?? "application/octet-stream",
    sizeBytes: Number(row.size_bytes ?? 0),
    createdAt: String(row.created_at),
  }));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] leading-tight font-bold tracking-tight">
            Thumbnail &amp; resources
          </h1>
          <p className="mt-1.5 text-[14px] text-muted-foreground">
            Files for <span className="font-medium text-foreground">{course.title}</span>. Uploads are stored
            privately and served through signed links.
          </p>
        </div>
        <StatusBadge status={course.status} />
      </header>

      <ResourceManager
        courseId={course.id}
        thumbnailKey={course.thumbnailKey}
        editable={course.status !== "published"}
        resources={resources}
      />
    </div>
  );
}
