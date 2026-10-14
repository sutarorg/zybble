import Link from "next/link";
import { notFound } from "next/navigation";
import { getCreatorCourse, getCreatorResources } from "@/lib/server/creator";
import { ResourceManager, type CourseResource } from "./resource-manager";

export const metadata = { title: "Content & resources" };
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
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <Link href={`/creator/courses/${course.id}/curriculum`} className="text-[12.5px] text-muted-foreground underline">
          ← Curriculum
        </Link>
        <h1 className="font-display mt-1 text-[26px] leading-tight font-bold tracking-tight">Content & resources</h1>
        <p className="mt-1.5 text-[14px] text-muted-foreground">
          Thumbnail and downloadable files for <span className="font-medium text-foreground">{course.title}</span>.
        </p>
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