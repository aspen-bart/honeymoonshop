import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { CategoryFormPage } from "../../CategoryFormPage";

export const metadata = { title: "Categorie bewerken" };

export default async function EditCategory({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const category = await db.category.findUnique({ where: { id: (await params).id } });
  if (!category) notFound();
  return <CategoryFormPage category={category} user={user} created={!!(await searchParams).nieuw} />;
}
