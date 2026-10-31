import type { Metadata } from "next";
import { EditPostClient } from "@/components/app/edit-post-client";

export const metadata: Metadata = { title: "Edit post" };

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;
  return <EditPostClient postId={postId} />;
}
