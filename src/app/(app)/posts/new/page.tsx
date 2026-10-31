import type { Metadata } from "next";
import { PostComposerWithContext } from "@/components/app/composer-with-context";

export const metadata: Metadata = { title: "New post" };

export default async function NewPostPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  return <PostComposerWithContext initialDate={date} />;
}
