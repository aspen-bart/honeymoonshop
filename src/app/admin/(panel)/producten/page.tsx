import Link from "next/link";
import { DataTable, PER_PAGE, readParams, type Column } from "@/components/admin/DataTable";
import { Notice, PageHeader, StatusBadge, fmtDate } from "@/components/admin/ui";
import { can, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { images } from "@/lib/json";
import type { Brand, Product } from "@prisma/client";

export const metadata = { title: "Producten" };
const KINDS = [
  { value: "dress", label: "Trouwjurken" },
  { value: "suit", label: "Trouwpakken" },
  { value: "accessory", label: "Accessoires" },
];

type Row = Product & { brand: Brand | null };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const params = readParams(sp, { sort: "updatedAt" }, ["soort", "status", "merk"]);
  const where = {
    ...(params.q ? { OR: [{ name: { contains: params.q } }, { path: { contains: params.q } }, { articleNumber: { contains: params.q } }] } : {}),
    ...(params.filters.soort ? { kind: params.filters.soort } : {}),
    ...(params.filters.status ? { status: params.filters.status } : {}),
    ...(params.filters.merk ? { brandId: params.filters.merk } : {}),
  };
  const sortable = ["name", "updatedAt", "sortOrder", "priceMin", "status"];
  const orderBy = { [sortable.includes(params.sort) ? params.sort : "updatedAt"]: params.dir };
  const [rows, total, brands, counts] = await Promise.all([
    db.product.findMany({ where, include: { brand: true }, orderBy, skip: (params.page - 1) * PER_PAGE, take: PER_PAGE }),
    db.product.count({ where }),
    db.brand.findMany({ where: params.filters.soort ? { kind: params.filters.soort } : {}, orderBy: { name: "asc" } }),
    db.product.groupBy({ by: ["kind"], _count: { _all: true } }),
  ]);
  const cols: Column<Row>[] = [
    {
      key: "image",
      label: "",
      className: "w-14",
      render: (r) => {
        const img = images(r.images)[0];
        // eslint-disable-next-line @next/next/no-img-element
        return img ? <img src={img.src} alt="" className="h-14 w-11 rounded-md object-cover" loading="lazy" /> : <span className="block h-14 w-11 rounded-md bg-cream" />;
      },
    },
    {
      key: "name",
      label: "Naam",
      sortable: true,
      render: (r) => (
        <div>
          <Link href={`/admin/producten/${r.id}/bewerken/`} className="font-medium hover:underline">
            {r.name}
          </Link>
          <p className="font-mono text-xs text-ink-soft">{r.path}</p>
        </div>
      ),
    },
    { key: "kind", label: "Soort", render: (r) => KINDS.find((k) => k.value === r.kind)?.label },
    { key: "brand", label: "Merk", render: (r) => r.brand?.name ?? "–" },
    { key: "priceMin", label: "Prijs", sortable: true, render: (r) => (r.price != null ? `€ ${r.price}` : (r.priceText ?? "–")) },
    { key: "status", label: "Status", sortable: true, render: (r) => <StatusBadge status={r.status} /> },
    { key: "updatedAt", label: "Gewijzigd", sortable: true, render: (r) => fmtDate(r.updatedAt) },
  ];
  const count = (k: string) => counts.find((c) => c.kind === k)?._count._all ?? 0;
  const current = params.filters.soort ?? "";
  return (
    <>
      <PageHeader title="Producten" description="Trouwjurken, trouwpakken en accessoires. Geen online afrekenen: prijzen zijn indicaties." />
      {sp.verwijderd && <Notice>Product verwijderd.</Notice>}
      <nav className="mb-4 flex flex-wrap gap-2" aria-label="Soort product">
        {[{ value: "", label: "Alles" }, ...KINDS].map((k) => (
          <Link key={k.value} href={k.value ? `/admin/producten/?soort=${k.value}` : "/admin/producten/"} aria-current={current === k.value ? "page" : undefined} className={`rounded-full border px-4 py-1.5 text-sm ${current === k.value ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink"}`}>
            {k.label} {k.value && <span className="opacity-60">({count(k.value)})</span>}
          </Link>
        ))}
      </nav>
      <DataTable
        base="/admin/producten/"
        params={params}
        columns={cols}
        rows={rows}
        total={total}
        searchLabel="Zoek op naam, pad of artikelnummer"
        filters={[
          { name: "soort", label: "Soort", options: KINDS },
          { name: "status", label: "Status", options: [{ value: "published", label: "Gepubliceerd" }, { value: "draft", label: "Concept" }] },
          { name: "merk", label: "Merk", options: brands.map((b) => ({ value: b.id, label: b.name })) },
        ]}
        newHref={can(user, "editor") ? `/admin/producten/nieuw/${current ? `?soort=${current}` : ""}` : undefined}
        newLabel="Nieuw product"
      />
    </>
  );
}
