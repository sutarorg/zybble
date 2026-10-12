import type { Metadata } from "next";
import { LearnPlayer } from "./learn-player";

export const metadata: Metadata = {
  title: "Course Player",
  description: "Your Zybble learning workspace.",
};

export default async function LearnPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ lesson?: string }>;
}) {
  const { courseId } = await params;
  const { lesson } = await searchParams;
  return <LearnPlayer courseKey={courseId} initialLessonId={typeof lesson === "string" ? lesson : null} />;
}
