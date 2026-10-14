import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Award, BookOpen, Globe2, MapPin, Star, Users } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CourseCard } from "@/components/courses/course-card";
import { SectionHeader } from "@/components/courses/section-header";
import { formatCompact } from "@/lib/format";
import { initialsOf } from "@/lib/format";
import { imagePath } from "@/lib/image-path";
import { cn } from "@/lib/utils";
import {
  getInstructorByUsername,
  getInstructorPublishedCourses,
  getInstructorStats,
} from "@/lib/server/catalog";
import { sortCourses } from "@/lib/courses";

export const dynamicParams = true;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const instructor = await getInstructorByUsername(username);
  if (!instructor) return { title: "Instructor" };
  return {
    title: String(instructor.display_name ?? "Instructor"),
    description: String(instructor.headline ?? ""),
  };
}

/**
 * Public instructor profile.
 *
 * Only a creator with a real `creator_profiles` row appears here, and the
 * course list is restricted to published courses by RLS. Route account ids,
 * onboarding status and KYC state are never exposed.
 */
export default async function InstructorPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const instructor = await getInstructorByUsername(username);
  if (!instructor) notFound();

  const userId = String(instructor.user_id);
  const [courses, stats] = await Promise.all([
    getInstructorPublishedCourses(userId),
    getInstructorStats(userId),
  ]);
  const sorted = sortCourses(courses, "popular");
  const students = stats.students;
  const reviews = stats.reviews;
  const rating = stats.rating;

  const displayName = String(instructor.display_name ?? "Zybble creator");
  const languages = (instructor.languages as string[] | null) ?? ["English"];
  const avatarKey = (instructor.avatar_key as string | null) ?? null;

  const statTiles = [
    { icon: Star, label: "Instructor rating", value: rating.toFixed(1), accent: true },
    { icon: Award, label: "Reviews", value: formatCompact(reviews) },
    { icon: Users, label: "Students", value: formatCompact(students) },
    { icon: BookOpen, label: "Courses", value: String(courses.length) },
  ];

  return (
    <div className="mx-auto max-w-330 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <Breadcrumb
        items={[{ label: "Explore", href: "/" }, { label: "Instructors" }, { label: displayName }]}
      />

      <header className="mt-6 rounded-2xl border border-border bg-gradient-to-br from-muted/70 to-white p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <Avatar className="size-24 shrink-0 ring-2 ring-white shadow-md">
            {avatarKey ? (
              // eslint-disable-next-line @next/next/no-img-element -- streamed from the private R2 bucket through a same-origin route
              <img src={imagePath("avatars", avatarKey)} alt="" className="size-24 rounded-full object-cover" />
            ) : (
              <AvatarFallback className="bg-violet-100 text-2xl font-bold text-violet-700">
                {initialsOf(displayName)}
              </AvatarFallback>
            )}
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold tracking-[0.14em] text-primary uppercase">Instructor</p>
            <h1 className="font-display mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{displayName}</h1>
            <p className="mt-1 text-[14.5px] text-muted-foreground">
              {String(instructor.headline ?? "")}
            </p>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[12.5px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <MapPin className="size-3.5 text-zinc-400" aria-hidden />
                India
              </span>
              <span className="flex items-center gap-1.5">
                <Globe2 className="size-3.5 text-zinc-400" aria-hidden /> Teaches in {languages.join(", ")}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {statTiles.map((tile) => (
            <div key={tile.label} className="rounded-xl border border-border bg-white p-4 shadow-card">
              <div className="flex items-center gap-2">
                <tile.icon
                  className={cn("size-4", tile.accent ? "fill-star text-star" : "text-zinc-400")}
                  aria-hidden
                />
                <span className="font-display text-lg font-bold tracking-tight tabular-nums">{tile.value}</span>
              </div>
              <p className="mt-0.5 text-[12px] text-muted-foreground">{tile.label}</p>
            </div>
          ))}
        </div>
      </header>

      {instructor.bio ? (
        <section className="mt-10 max-w-3xl">
          <h2 className="font-display text-lg font-semibold tracking-tight">About</h2>
          <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">{String(instructor.bio)}</p>
        </section>
      ) : null}

      <div className="mt-10">
        <SectionHeader
          title={`Courses by ${displayName.split(" ")[0]}`}
          description={`${courses.length} ${courses.length === 1 ? "course" : "courses"} · ${formatCompact(students)} students enrolled`}
        />
        {courses.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            className="mt-6"
            title="No published courses yet"
            description="This instructor hasn't published a course on Zybble yet. Check back soon."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {courses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
