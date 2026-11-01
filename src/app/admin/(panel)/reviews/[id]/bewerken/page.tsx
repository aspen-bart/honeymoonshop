import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ReviewFormPage } from "../../ReviewFormPage";

export const metadata = { title: "Review bewerken" };

export default async function EditReview({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const review = await db.review.findUnique({ where: { id: (await params).id } });
  if (!review) notFound();
  return <ReviewFormPage review={review} user={user} created={!!(await searchParams).nieuw} />;
}
