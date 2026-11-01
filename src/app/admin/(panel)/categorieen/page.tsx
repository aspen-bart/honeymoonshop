import Link from "next/link";
import { DataTable, PER_PAGE, readParams, type Column } from "@/components/admin/DataTable";
import { Notice, PageHeader, StatusBadge } from "@/components/admin/ui";
import { can, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { like } from "@/lib/search";
import type { Category } from "@prisma/client";

export const metadata = { title: "Categorieën" };
const KIND: Record<string, string> = { accessory: "Accessoires", dress: "Collectie trouwjurken", suit: "Collectie trouwpakken" };

type Row = Category & { parent: Category | null; _count: { products: number } };

export default async function CategoriesAdmin({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const params = readParams(sp, { sort: "sortOrder", dir: "asc" }, ["soort"]);
  const where = { ...(params.q ? { OR: [{ name: like(params.q) }, { path: like(params.q) }] } : {}), ...(params.filters.soort ? { kind: params.filters.soort } : {}) };
  const orderBy = { [["name", "path", "sortOrder"].includes(params.sort) ? params.sort : "sortOrder"]: params.dir };
  const [rows, total] = await Promise.all([db.category.findMany({ where, include: { parent: true, _count: { select: { products: true } } }, orderBy, skip: (params.page - 1) * PER_PAGE, take: PER_PAGE }), db.category.count({ where })]);
  const cols: Column<Row>[] = [
    {
      key: "name",
      label: "Naam",
      sortable: true,
      render: (r) => (
        <div>
          <Link href={`/admin/categorieen/${r.id}/bewerken/`} className="font-medium hover:underline">
            {r.name}
          </Link>
          {r.parent && <p className="text-xs text-ink-soft">in {r.parent.name}</p>}
        </div>
      ),
    },
    { key: "path", label: "URL", sortable: true, render: (r) => <span className="font-mono text-xs">{r.path}</span> },
    { key: "kind", label: "Soort", render: (r) => KIND[r.kind] },
    { key: "products", label: "Producten", render: (r) => r._count.products },
    { key: "sortOrder", label: "Volgorde", sortable: true, render: (r) => r.sortOrder },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];
  return (
    <>
      <PageHeader title="Categorieën" description="Accessoirecategorieën (met tekst boven én onder de producten) en collecties van trouwjurken en trouwpakken." />
      {sp.verwijderd && <Notice>Categorie verwijderd.</Notice>}
      <DataTable base="/admin/categorieen/" params={params} columns={cols} rows={rows} total={total} searchLabel="Zoek op naam of URL" filters={[{ name: "soort", label: "Soort", options: Object.entries(KIND).map(([value, label]) => ({ value, label })) }]} newHref={can(user, "editor") ? "/admin/categorieen/nieuw/" : undefined} newLabel="Nieuwe categorie" />
    </>
  );
}
