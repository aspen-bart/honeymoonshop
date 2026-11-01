import Link from "next/link";
import { DataTable, PER_PAGE, readParams, type Column } from "@/components/admin/DataTable";
import { Badge, Notice, PageHeader, StatusBadge, fmtDate } from "@/components/admin/ui";
import { can, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { like } from "@/lib/search";
import type { Page } from "@prisma/client";

export const metadata = { title: "Pagina's" };

const TEMPLATES: Record<string, string> = { default: "Standaard", home: "Homepage", appointment: "Afspraakplanner", contact: "Contact", listing: "Overzicht", thanks: "Bedankpagina", newsletter: "Look Book-aanvraag", "review-submit": "Verhaal insturen", favorites: "Favorieten" };

export default async function PagesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const params = readParams(sp, { sort: "path", dir: "asc" }, ["status", "template"]);
  const where = {
    ...(params.q ? { OR: [{ title: like(params.q) }, { path: like(params.q) }] } : {}),
    ...(params.filters.status ? { status: params.filters.status } : {}),
    ...(params.filters.template ? { template: params.filters.template } : {}),
  };
  const orderBy = { [["title", "path", "updatedAt", "status"].includes(params.sort) ? params.sort : "path"]: params.dir };
  const [rows, total] = await Promise.all([db.page.findMany({ where, orderBy, skip: (params.page - 1) * PER_PAGE, take: PER_PAGE }), db.page.count({ where })]);
  const cols: Column<Page>[] = [
    {
      key: "title",
      label: "Titel",
      sortable: true,
      render: (r) => (
        <Link href={`/admin/paginas/${r.id}/bewerken/`} className="font-medium hover:underline">
          {r.title}
        </Link>
      ),
    },
    { key: "path", label: "URL", sortable: true, render: (r) => <span className="font-mono text-xs">{r.path}</span> },
    { key: "template", label: "Type", render: (r) => TEMPLATES[r.template] ?? r.template },
    { key: "status", label: "Status", sortable: true, render: (r) => <span className="flex gap-1"><StatusBadge status={r.status} />{r.noindex && <Badge>noindex</Badge>}</span> },
    { key: "updatedAt", label: "Gewijzigd", sortable: true, render: (r) => fmtDate(r.updatedAt) },
  ];
  return (
    <>
      <PageHeader title="Pagina's" description="Alle losse pagina's van de website, inclusief de homepage en de overzichtspagina's." />
      {sp.verwijderd && <Notice>Pagina verwijderd.</Notice>}
      <DataTable
        base="/admin/paginas/"
        params={params}
        columns={cols}
        rows={rows}
        total={total}
        searchLabel="Zoek op titel of URL"
        filters={[
          { name: "status", label: "Status", options: [{ value: "published", label: "Gepubliceerd" }, { value: "draft", label: "Concept" }] },
          { name: "template", label: "Type", options: Object.entries(TEMPLATES).map(([value, label]) => ({ value, label })) },
        ]}
        newHref={can(user, "editor") ? "/admin/paginas/nieuw/" : undefined}
        newLabel="Nieuwe pagina"
      />
    </>
  );
}
