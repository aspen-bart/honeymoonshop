import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { BlogFormPage } from "../../BlogFormPage";

export const metadata = { title: "Blog bewerken" };

export default async function EditPost({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const post = await db.post.findUnique({ where: { id: (await params).id } });
  if (!post) notFound();
  return <BlogFormPage post={post} user={user} created={!!(await searchParams).nieuw} />;
}
