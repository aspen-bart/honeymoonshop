import Link from "next/link";
import { Icon, type IconName } from "@/components/Icon";
import { PageHeader, Panel, Stat, btn, btnSm } from "@/components/admin/ui";
import { can, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata = { title: "Shop" };

const KINDS = [
  { value: "dress", label: "Trouwjurken", site: "/trouwjurken/" },
  { value: "suit", label: "Trouwpakken", site: "/pakken/" },
  { value: "accessory", label: "Accessoires", site: "/bruid/accessoires/" },
] as const;

type CatRow = { id: string; name: string; path: string; kind: string; parentId: string | null; status: string; _count: { products: number } };

// Startpunt van de shop: aantallen per soort, aandachtspunten en de categorieboom met productaantallen.
export default async function ShopOverview() {
  const user = await requireUser();
  const [byKind, byStatus, sale, featured, noPrice, noImage, noCategory, cats, brands] = await Promise.all([
    db.product.groupBy({ by: ["kind"], _count: { _all: true } }),
    db.product.groupBy({ by: ["kind", "status"], _count: { _all: true } }),
    db.product.count({ where: { sale: true } }),
    db.product.count({ where: { featured: true } }),
    db.product.count({ where: { priceMin: null, price: null, priceText: null } }),
    db.product.count({ where: { images: "[]" } }),
    db.product.count({ where: { categories: { none: {} }, kind: "accessory" } }),
    db.category.findMany({ orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, path: true, kind: true, parentId: true, status: true, _count: { select: { products: true } } } }),
    db.brand.groupBy({ by: ["kind"], _count: { _all: true } }),
  ]);
  const total = (k: string) => byKind.find((x) => x.kind === k)?._count._all ?? 0;
  const drafts = (k: string) => byStatus.find((x) => x.kind === k && x.status === "draft")?._count._all ?? 0;
  const brandCount = (k: string) => brands.find((x) => x.kind === k)?._count._all ?? 0;
  const tree = (kind: string, parentId: string | null, depth = 0): React.ReactNode[] =>
    (cats as CatRow[])
      .filter((c) => c.kind === kind && c.parentId === parentId)
      .flatMap((c) => [
        <li key={c.id} className="flex items-center justify-between gap-3 py-1.5" style={{ paddingLeft: depth * 16 }}>
          <Link href={`/admin/shop/categorieen/${c.id}/bewerken/`} className="truncate hover:underline">
            {depth > 0 && <span className="text-ink-soft">└ </span>}
            {c.name}
            {c.status === "draft" && <span className="ml-1 text-xs text-[#9a6b00]">(concept)</span>}
          </Link>
          <Link href={`/admin/shop/producten/?categorie=${c.id}`} className="shrink-0 rounded-full bg-cream px-2 text-xs text-ink-soft hover:bg-cream-2" title="Producten in deze categorie">
            {c._count.products}
          </Link>
        </li>,
        ...tree(kind, c.id, depth + 1),
      ]);
  const attention: [string, number, string, IconName][] = [
    ["Zonder prijs", noPrice, "/admin/shop/prijzen/?zonder=1", "star"],
    ["Zonder foto", noImage, "/admin/shop/producten/?foto=geen", "camera"],
    ["Accessoires zonder categorie", noCategory, "/admin/shop/producten/?soort=accessory&categorie=geen", "filter"],
  ];
  return (
    <>
      <PageHeader
        title="Shop"
        description="Alle producten, categorieën, prijzen en specificaties. Geen online afrekenen: prijzen zijn indicaties en bezoekers maken een pasafspraak."
        action={
          can(user, "editor") && (
            <>
              <Link href="/admin/shop/producten/nieuw/" className={btn}>
                + Nieuw product
              </Link>
              <Link href="/admin/shop/categorieen/nieuw/" className={btnSm}>
                + Categorie
              </Link>
            </>
          )
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {KINDS.map((k) => (
          <Stat key={k.value} label={k.label} value={total(k.value)} href={`/admin/shop/producten/?soort=${k.value}`} sub={`${drafts(k.value)} concept · ${brandCount(k.value)} merken`} />
        ))}
        <Stat label="Sale / uitgelicht" value={`${sale} / ${featured}`} href="/admin/shop/producten/?sale=1" sub="met sale-label / op de homepage" />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {attention.map(([label, n, href, icon]) => (
          <Link key={label} href={href} className={`flex items-center gap-3 rounded-2xl border p-4 transition hover:border-ink ${n ? "border-[#f3d58a] bg-[#fdf6e3]" : "border-line bg-white"}`}>
            <Icon name={icon} className="h-5 w-5 text-ink-soft" />
            <span className="flex-1 text-sm">{label}</span>
            <span className="text-lg font-semibold">{n}</span>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {KINDS.map((k) => (
          <Panel
            key={k.value}
            title={`Categorieën ${k.label.toLowerCase()}`}
            action={
              <a href={k.site} target="_blank" className="text-xs underline">
                Op de site ↗
              </a>
            }
          >
            <ul className="max-h-[420px] divide-y divide-line overflow-y-auto text-sm">{tree(k.value, null)}</ul>
            {!cats.some((c) => c.kind === k.value) && <p className="text-sm text-ink-soft">Nog geen categorieën.</p>}
          </Panel>
        ))}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Producten", "Zoeken, filteren en bulkacties", "/admin/shop/producten/", "heart"],
          ["Prijzen", "Alle prijzen in één tabel, of in één keer verhogen", "/admin/shop/prijzen/", "star"],
          ["Specificaties", "Kenmerken en vaste velden per soort", "/admin/shop/specificaties/", "scissors"],
          ["Merken", "Merken van jurken, pakken en accessoires", "/admin/shop/merken/", "sparkle"],
        ].map(([t, d, href, icon]) => (
          <Link key={href} href={href} className="group rounded-2xl border border-line bg-white p-5 transition hover:border-ink">
            <Icon name={icon as IconName} className="h-5 w-5 text-lilac-700" />
            <p className="mt-3 font-semibold">{t}</p>
            <p className="text-sm text-ink-soft">{d}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
