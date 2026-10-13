"use client";
import { notFound } from "next/navigation";
import { useCreator } from "@/components/providers/creator-provider";
import { useApp } from "@/components/providers/app-providers";
import { getDictionary } from "@/lib/i18n";
import { CourseCard } from "@/components/courses/course-card";

export function SessionInstructor({ username }: { username: string }) {
  const { profile, communityCourses, hydrated } = useCreator();
  const { language } = useApp();
  const d = getDictionary(language);
  if (!hydrated) return <div className="page-container py-10" aria-busy="true" />;
  if (!profile.onboardedAt || profile.instructorId !== username) notFound();
  const courses = communityCourses.filter((c) => c.instructorId === profile.instructorId);
  return <div className="page-container py-10"><header className="max-w-2xl"><p className="text-xs font-semibold uppercase tracking-wide text-primary">{d.instructor}</p><h1 className="font-display mt-3 text-3xl font-bold">{profile.displayName}</h1><p className="mt-2 text-sm text-muted-foreground">{profile.headline}</p></header><section className="mt-8 max-w-2xl"><h2 className="font-display text-lg font-semibold">{d.aboutMe}</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{profile.bio}</p></section><section className="mt-10"><h2 className="font-display mb-4 text-lg font-semibold">{d.instructorCourses}</h2>{courses.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{courses.map((course) => <CourseCard key={course.id} course={course} />)}</div> : <p className="text-sm text-muted-foreground">{d.courseCount(0)}</p>}</section></div>;
}
