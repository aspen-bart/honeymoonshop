import Link from "next/link";
import { saveMeta } from "@/app/admin/actions/extra";
import { DataTable, PER_PAGE, readParams, type Column } from "@/components/admin/DataTable";
import { MetaQuickEdit } from "@/components/admin/MetaQuickEdit";
import { Notice, PageHeader, StatusBadge, fmtDate } from "@/components/admin/ui";
import { can, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { like } from "@/lib/search";
import type { BlogCategory, Post } from "@prisma/client";

export const metadata = { title: "Blogs" };

type Row = Post & { category: BlogCategory | null };

export default async function BlogAdmin({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const params = readParams(sp, { sort: "publishedAt" }, ["status", "categorie"]);
  const where = {
    ...(params.q ? { OR: [{ title: like(params.q) }, { path: like(params.q) }] } : {}),
    ...(params.filters.status ? { status: params.filters.status } : {}),
    ...(params.filters.categorie ? { categoryId: params.filters.categorie } : {}),
  };
  const orderBy = { [["title", "publishedAt", "updatedAt", "status"].includes(params.sort) ? params.sort : "publishedAt"]: params.dir };
  const [rows, total, cats] = await Promise.all([db.post.findMany({ where, include: { category: true }, orderBy, skip: (params.page - 1) * PER_PAGE, take: PER_PAGE }), db.post.count({ where }), db.blogCategory.findMany({ orderBy: { name: "asc" } })]);
  const cols: Column<Row>[] = [
    {
      key: "image",
      label: "",
      className: "w-20",
      render: (r) =>
        r.heroImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.heroImage} alt="" loading="lazy" className="h-12 w-16 rounded-md object-cover" />
        ) : (
          <span className="grid h-12 w-16 place-items-center rounded-md bg-cream text-[0.6rem] text-ink-soft">geen beeld</span>
        ),
    },
    {
      key: "title",
      label: "Titel",
      sortable: true,
      render: (r) => (
        <div>
          <Link href={`/admin/blogs/${r.id}/bewerken/`} className="font-medium hover:underline">
            {r.title}
          </Link>
          <p className="font-mono text-xs text-ink-soft">{r.path}</p>
        </div>
      ),
    },
    { key: "category", label: "Categorie", render: (r) => r.category?.name ?? "–" },
    { key: "meta", label: "Meta-title en -description", render: (r) => <MetaQuickEdit action={saveMeta.bind(null, "post", r.id)} metaTitle={r.metaTitle} metaDescription={r.metaDescription} fallbackTitle={r.title} readOnly={!can(user, "editor")} /> },
    { key: "status", label: "Status", sortable: true, render: (r) => <StatusBadge status={r.status} /> },
    { key: "publishedAt", label: "Publicatie", sortable: true, render: (r) => fmtDate(r.publishedAt) },
  ];
  return (
    <>
      <PageHeader title="Blogs" description={`Alle ${total} blogs: tekst aanpassen in de editor, met uitgelichte afbeelding, social-voorvertoning en SEO-velden.`} />
      {sp.verwijderd && <Notice>Blog verwijderd.</Notice>}
      <DataTable
        base="/admin/blogs/"
        params={params}
        columns={cols}
        rows={rows}
        total={total}
        searchLabel="Zoek op titel of URL"
        filters={[
          { name: "status", label: "Status", options: [{ value: "published", label: "Gepubliceerd" }, { value: "draft", label: "Concept" }] },
          { name: "categorie", label: "Categorie", options: cats.map((c) => ({ value: c.id, label: c.name })) },
        ]}
        newHref={can(user, "editor") ? "/admin/blogs/nieuw/" : undefined}
        newLabel="Nieuwe blog"
      />
    </>
  );
}
