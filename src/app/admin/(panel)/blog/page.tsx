import Link from "next/link";
import { DataTable, PER_PAGE, readParams, type Column } from "@/components/admin/DataTable";
import { Notice, PageHeader, StatusBadge, fmtDate } from "@/components/admin/ui";
import { can, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import type { BlogCategory, Post } from "@prisma/client";

export const metadata = { title: "Blog" };

type Row = Post & { category: BlogCategory | null };

export default async function BlogAdmin({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const params = readParams(sp, { sort: "publishedAt" }, ["status", "categorie"]);
  const where = {
    ...(params.q ? { OR: [{ title: { contains: params.q } }, { path: { contains: params.q } }] } : {}),
    ...(params.filters.status ? { status: params.filters.status } : {}),
    ...(params.filters.categorie ? { categoryId: params.filters.categorie } : {}),
  };
  const orderBy = { [["title", "publishedAt", "updatedAt", "status"].includes(params.sort) ? params.sort : "publishedAt"]: params.dir };
  const [rows, total, cats] = await Promise.all([db.post.findMany({ where, include: { category: true }, orderBy, skip: (params.page - 1) * PER_PAGE, take: PER_PAGE }), db.post.count({ where }), db.blogCategory.findMany({ orderBy: { name: "asc" } })]);
  const cols: Column<Row>[] = [
    {
      key: "title",
      label: "Titel",
      sortable: true,
      render: (r) => (
        <div>
          <Link href={`/admin/blog/${r.id}/bewerken/`} className="font-medium hover:underline">
            {r.title}
          </Link>
          <p className="font-mono text-xs text-ink-soft">{r.path}</p>
        </div>
      ),
    },
    { key: "category", label: "Categorie", render: (r) => r.category?.name ?? "–" },
    { key: "status", label: "Status", sortable: true, render: (r) => <StatusBadge status={r.status} /> },
    { key: "publishedAt", label: "Publicatie", sortable: true, render: (r) => fmtDate(r.publishedAt) },
    { key: "updatedAt", label: "Gewijzigd", sortable: true, render: (r) => fmtDate(r.updatedAt) },
  ];
  return (
    <>
      <PageHeader title="Blog" description="Artikelen met eigen URL onder /blog/, categorie, publicatiedatum en SEO-velden." />
      {sp.verwijderd && <Notice>Blog verwijderd.</Notice>}
      <DataTable
        base="/admin/blog/"
        params={params}
        columns={cols}
        rows={rows}
        total={total}
        searchLabel="Zoek op titel of URL"
        filters={[
          { name: "status", label: "Status", options: [{ value: "published", label: "Gepubliceerd" }, { value: "draft", label: "Concept" }] },
          { name: "categorie", label: "Categorie", options: cats.map((c) => ({ value: c.id, label: c.name })) },
        ]}
        newHref={can(user, "editor") ? "/admin/blog/nieuw/" : undefined}
        newLabel="Nieuwe blog"
      />
    </>
  );
}
