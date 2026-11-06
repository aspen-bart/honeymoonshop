import Link from "next/link";
import { bulkProducts, saveMeta } from "@/app/admin/actions/extra";
import { BULK_FORM, BulkBar } from "@/components/admin/BulkBar";
import { DataTable, PER_PAGE, readParams, type Column } from "@/components/admin/DataTable";
import { MetaQuickEdit } from "@/components/admin/MetaQuickEdit";
import { Badge, Notice, PageHeader, StatusBadge, fmtDate } from "@/components/admin/ui";
import { can, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { like } from "@/lib/search";
import { images } from "@/lib/json";
import type { Brand, Product } from "@prisma/client";

export const metadata = { title: "Producten" };
const KINDS = [
  { value: "dress", label: "Trouwjurken" },
  { value: "suit", label: "Trouwpakken" },
  { value: "accessory", label: "Accessoires" },
];

type Row = Product & { brand: Brand | null; categories: { name: string }[] };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const params = readParams(sp, { sort: "updatedAt" }, ["soort", "status", "merk", "categorie", "foto", "sale", "seo"]);
  const where = {
    ...(params.q ? { OR: [{ name: like(params.q) }, { path: like(params.q) }, { articleNumber: like(params.q) }] } : {}),
    ...(params.filters.soort ? { kind: params.filters.soort } : {}),
    ...(params.filters.status ? { status: params.filters.status } : {}),
    ...(params.filters.merk ? { brandId: params.filters.merk } : {}),
    ...(params.filters.categorie === "geen" ? { categories: { none: {} } } : params.filters.categorie ? { categories: { some: { id: params.filters.categorie } } } : {}),
    ...(params.filters.foto === "geen" ? { images: "[]" } : {}),
    ...(params.filters.sale === "1" ? { sale: true } : {}),
    ...(params.filters.seo === "zonder" ? { AND: [{ OR: [{ metaDescription: null }, { metaDescription: "" }] }] } : {}),
  };
  const sortable = ["name", "updatedAt", "sortOrder", "priceMin", "status"];
  const orderBy = { [sortable.includes(params.sort) ? params.sort : "updatedAt"]: params.dir };
  const [rows, total, brands, counts, categories] = await Promise.all([
    db.product.findMany({ where, include: { brand: true, categories: { select: { name: true } } }, orderBy, skip: (params.page - 1) * PER_PAGE, take: PER_PAGE }),
    db.product.count({ where }),
    db.brand.findMany({ where: params.filters.soort ? { kind: params.filters.soort } : {}, orderBy: { name: "asc" } }),
    db.product.groupBy({ by: ["kind"], _count: { _all: true } }),
    db.category.findMany({ where: params.filters.soort ? { kind: params.filters.soort } : {}, orderBy: [{ kind: "asc" }, { name: "asc" }], select: { id: true, name: true, kind: true } }),
  ]);
  const editor = can(user, "editor");
  const cols: Column<Row>[] = [
    ...(editor ? [{ key: "select", label: "", className: "w-8", render: (r: Row) => <input type="checkbox" name="ids" value={r.id} form={BULK_FORM} aria-label={`${r.name} selecteren`} /> }] : []),
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
          <Link href={`/admin/shop/producten/${r.id}/bewerken/`} className="font-medium hover:underline">
            {r.name}
          </Link>
          <p className="font-mono text-xs text-ink-soft">{r.path}</p>
        </div>
      ),
    },
    {
      key: "kind",
      label: "Soort / merk",
      render: (r) => (
        <div className="text-xs">
          <p>{KINDS.find((k) => k.value === r.kind)?.label}</p>
          <p className="text-ink-soft">{r.brand?.name ?? "geen merk"}</p>
        </div>
      ),
    },
    { key: "categories", label: "Categorieën", render: (r) => <span className="line-clamp-2 max-w-[200px] text-xs text-ink-soft">{r.categories.map((c) => c.name).join(", ") || "–"}</span> },
    { key: "priceMin", label: "Prijs", sortable: true, render: (r) => <span className="whitespace-nowrap">{r.price != null ? `€ ${r.price}` : (r.priceText ?? "–")}</span> },
    { key: "meta", label: "SEO", render: (r) => <MetaQuickEdit action={saveMeta.bind(null, "product", r.id)} metaTitle={r.metaTitle} metaDescription={r.metaDescription} fallbackTitle={r.name} readOnly={!editor} /> },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (r) => (
        <span className="flex flex-col items-start gap-1">
          <StatusBadge status={r.status} />
          {r.sale && <Badge tone="danger">sale</Badge>}
          {r.featured && <Badge tone="brand">uitgelicht</Badge>}
        </span>
      ),
    },
    { key: "updatedAt", label: "Gewijzigd", sortable: true, render: (r) => fmtDate(r.updatedAt) },
  ];
  const count = (k: string) => counts.find((c) => c.kind === k)?._count._all ?? 0;
  const current = params.filters.soort ?? "";
  return (
    <>
      <PageHeader title="Producten" description="Trouwjurken, trouwpakken en accessoires. Selecteer producten voor bulkacties; prijzen pas je in één keer aan bij Prijzen." />
      {sp.verwijderd && <Notice>Product verwijderd.</Notice>}
      <nav className="mb-4 flex flex-wrap gap-2" aria-label="Soort product">
        {[{ value: "", label: "Alles" }, ...KINDS].map((k) => (
          <Link key={k.value} href={k.value ? `/admin/shop/producten/?soort=${k.value}` : "/admin/shop/producten/"} aria-current={current === k.value ? "page" : undefined} className={`rounded-full border px-4 py-1.5 text-sm ${current === k.value ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink"}`}>
            {k.label} {k.value && <span className="opacity-60">({count(k.value)})</span>}
          </Link>
        ))}
      </nav>
      {editor && <BulkBar action={bulkProducts} categories={categories} brands={brands} canDelete={can(user, "admin")} />}
      <DataTable
        base="/admin/shop/producten/"
        params={params}
        columns={cols}
        rows={rows}
        total={total}
        searchLabel="Zoek op naam, pad of artikelnummer"
        filters={[
          { name: "soort", label: "Soort", options: KINDS },
          { name: "status", label: "Status", options: [{ value: "published", label: "Gepubliceerd" }, { value: "draft", label: "Concept" }] },
          { name: "merk", label: "Merk", options: brands.map((b) => ({ value: b.id, label: b.name })) },
          { name: "categorie", label: "Categorie", options: [{ value: "geen", label: "Zonder categorie" }, ...categories.map((c) => ({ value: c.id, label: c.name }))] },
          { name: "foto", label: "Foto", options: [{ value: "geen", label: "Zonder foto" }] },
          { name: "sale", label: "Sale", options: [{ value: "1", label: "Met sale-label" }] },
          { name: "seo", label: "Meta-description", options: [{ value: "zonder", label: "Ontbreekt" }] },
        ]}
        newHref={can(user, "editor") ? `/admin/shop/producten/nieuw/${current ? `?soort=${current}` : ""}` : undefined}
        newLabel="Nieuw product"
      />
    </>
  );
}
