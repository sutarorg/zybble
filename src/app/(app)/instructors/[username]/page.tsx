import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Award, BookOpen, Globe2, MapPin, Star, Users } from "lucide-react";
import { INSTRUCTORS } from "@/data/mock-data";
import { coursesByInstructor, getInstructorByUsername, instructorStats, sortCourses } from "@/lib/courses";
import { formatCompact } from "@/lib/format";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CourseCard } from "@/components/courses/course-card";
import { SectionHeader } from "@/components/courses/section-header";
import { cn } from "@/lib/utils";

export function generateStaticParams() {
  return INSTRUCTORS.map((i) => ({ username: i.username }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const instructor = getInstructorByUsername(username);
  if (!instructor) return {};
  return { title: instructor.name, description: instructor.headline };
}

export default async function InstructorPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const instructor = getInstructorByUsername(username);
  if (!instructor) notFound();

  const stats = instructorStats(instructor.id);
  const courses = sortCourses(coursesByInstructor(instructor.id), "popular");

  const statTiles = [
    { icon: Star, label: "Instructor rating", value: stats.rating.toFixed(1), accent: true },
    { icon: Award, label: "Reviews", value: formatCompact(stats.reviews) },
    { icon: Users, label: "Students", value: formatCompact(stats.students) },
    { icon: BookOpen, label: "Courses", value: String(stats.courses) },
  ];

  return (
    <div className="mx-auto max-w-330 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <Breadcrumb
        items={[
          { label: "Explore", href: "/explore" },
          { label: "Instructors" },
          { label: instructor.name },
        ]}
      />

      {/* Profile header */}
      <header className="mt-6 rounded-2xl border border-border bg-gradient-to-br from-muted/70 to-white p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <Avatar className="size-24 shrink-0 ring-2 ring-white shadow-md">
            <AvatarFallback className={cn("text-2xl font-bold", instructor.avatarColor)}>
              {instructor.initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold tracking-[0.14em] text-primary uppercase">
              Instructor
            </p>
            <h1 className="font-display mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
              {instructor.name}
            </h1>
            <p className="mt-1 text-[14.5px] text-muted-foreground">{instructor.headline}</p>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[12.5px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <MapPin className="size-3.5 text-zinc-400" aria-hidden />
                {instructor.country}
              </span>
              <span className="flex items-center gap-1.5">
                <Globe2 className="size-3.5 text-zinc-400" aria-hidden />
                Teaches in {instructor.languages.join(", ")}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {statTiles.map((tile) => (
            <div
              key={tile.label}
              className="rounded-xl border border-border bg-white p-4 shadow-card"
            >
              <div className="flex items-center gap-2">
                <tile.icon
                  className={cn("size-4", tile.accent ? "fill-star text-star" : "text-zinc-400")}
                  aria-hidden
                />
                <span className="font-display text-lg font-bold tracking-tight tabular-nums">
                  {tile.value}
                </span>
              </div>
              <p className="mt-0.5 text-[12px] text-muted-foreground">{tile.label}</p>
            </div>
          ))}
        </div>
      </header>

      {/* About */}
      <section className="mt-10 max-w-3xl">
        <h2 className="font-display text-lg font-semibold tracking-tight">About</h2>
        <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">{instructor.bio}</p>
      </section>

      {/* Courses */}
      <div className="mt-10">
        <SectionHeader
          title={`Courses by ${instructor.name.split(" ")[0]}`}
          description={`${stats.courses} ${stats.courses === 1 ? "course" : "courses"} · ${formatCompact(stats.students)} students enrolled`}
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      </div>
    </div>
  );
}
