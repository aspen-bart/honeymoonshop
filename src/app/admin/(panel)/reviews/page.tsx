import Link from "next/link";
import { DataTable, PER_PAGE, readParams, type Column } from "@/components/admin/DataTable";
import { Badge, Notice, PageHeader, StatusBadge, fmtDate } from "@/components/admin/ui";
import { can, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { like } from "@/lib/search";
import type { Review } from "@prisma/client";

export const metadata = { title: "Reviews" };

export default async function ReviewsAdmin({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const params = readParams(sp, { sort: "publishedAt" }, ["status", "uitgelicht"]);
  const where = {
    ...(params.q ? { OR: [{ name: like(params.q) }, { path: like(params.q) }] } : {}),
    ...(params.filters.status ? { status: params.filters.status } : {}),
    ...(params.filters.uitgelicht ? { featured: params.filters.uitgelicht === "ja" } : {}),
  };
  const orderBy = { [["name", "publishedAt", "status"].includes(params.sort) ? params.sort : "publishedAt"]: params.dir };
  const [rows, total] = await Promise.all([db.review.findMany({ where, orderBy, skip: (params.page - 1) * PER_PAGE, take: PER_PAGE }), db.review.count({ where })]);
  const cols: Column<Review>[] = [
    {
      key: "image",
      label: "",
      className: "w-14",
      // eslint-disable-next-line @next/next/no-img-element
      render: (r) => (r.image ? <img src={r.image} alt="" className="h-12 w-12 rounded-md object-cover" loading="lazy" /> : <span className="block h-12 w-12 rounded-md bg-cream" />),
    },
    {
      key: "name",
      label: "Real bride / groom",
      sortable: true,
      render: (r) => (
        <div>
          <Link href={`/admin/reviews/${r.id}/bewerken/`} className="font-medium hover:underline">
            {r.name}
          </Link>
          <p className="font-mono text-xs text-ink-soft">{r.path}</p>
        </div>
      ),
    },
    { key: "status", label: "Status", sortable: true, render: (r) => <span className="flex gap-1"><StatusBadge status={r.status} />{r.featured && <Badge tone="brand">uitgelicht</Badge>}</span> },
    { key: "publishedAt", label: "Datum", sortable: true, render: (r) => fmtDate(r.publishedAt) },
  ];
  return (
    <>
      <PageHeader title="Reviews" description="De verhalen van Real Brides & Grooms. Ingestuurde verhalen komen binnen als concept." />
      {sp.verwijderd && <Notice>Review verwijderd.</Notice>}
      <DataTable
        base="/admin/reviews/"
        params={params}
        columns={cols}
        rows={rows}
        total={total}
        searchLabel="Zoek op naam"
        filters={[
          { name: "status", label: "Status", options: [{ value: "published", label: "Gepubliceerd" }, { value: "draft", label: "Concept" }] },
          { name: "uitgelicht", label: "Uitgelicht", options: [{ value: "ja", label: "Ja" }, { value: "nee", label: "Nee" }] },
        ]}
        newHref={can(user, "editor") ? "/admin/reviews/nieuw/" : undefined}
        newLabel="Nieuwe review"
      />
    </>
  );
}
