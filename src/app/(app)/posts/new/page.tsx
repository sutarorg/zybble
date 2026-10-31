import type { Metadata } from "next";
import { PostComposer } from "@/components/app/post-composer";

export const metadata: Metadata = { title: "New post" };

export default async function NewPostPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  return <PostComposer initialDate={date} />;
}
