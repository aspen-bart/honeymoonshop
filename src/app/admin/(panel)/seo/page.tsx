import Link from "next/link";
import { saveMeta, saveSeoSettings } from "@/app/admin/actions/extra";
import { MetaQuickEdit } from "@/components/admin/MetaQuickEdit";
import { SimpleForm } from "@/components/admin/SimpleForm";
import { Badge, Field, PageHeader, Panel, Stat, btn, input } from "@/components/admin/ui";
import { can, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSeo } from "@/lib/settings";

export const metadata = { title: "SEO" };

type Table = "page" | "post" | "category" | "product" | "review";
type Row = { id: string; table: Table; type: string; title: string; path: string; status: string; metaTitle: string | null; metaDescription: string | null; noindex: boolean; edit: string };

const TYPES: { value: Table; label: string }[] = [
  { value: "page", label: "Pagina's" },
  { value: "post", label: "Blogs" },
  { value: "category", label: "Categorieën" },
  { value: "product", label: "Producten" },
  { value: "review", label: "Reviews" },
];
const ISSUES: Record<string, { label: string; test: (r: Row, dupes: Set<string>) => boolean }> = {
  "desc-leeg": { label: "Meta-description ontbreekt", test: (r) => !r.metaDescription },
  "desc-lengte": { label: "Description te kort of te lang", test: (r) => !!r.metaDescription && (r.metaDescription.length < 120 || r.metaDescription.length > 160) },
  "title-lengte": { label: "Meta-title te lang (> 60)", test: (r) => (r.metaTitle ?? "").length > 60 },
  dubbel: { label: "Dubbele meta-title", test: (r, d) => !!r.metaTitle && d.has(r.metaTitle) },
  noindex: { label: "Niet geïndexeerd (noindex/concept)", test: (r) => r.noindex || r.status === "draft" },
};
const PER = 50;

// Eén overzicht van alle URL's met hun meta-gegevens: problemen vinden en direct oplossen, plus algemene SEO-instellingen.
export default async function SeoPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const sel = { id: true, path: true, status: true, metaTitle: true, metaDescription: true } as const;
  const [pages, posts, cats, products, reviews, seo, redirects] = await Promise.all([
    db.page.findMany({ select: { ...sel, title: true, noindex: true } }),
    db.post.findMany({ select: { ...sel, title: true } }),
    db.category.findMany({ select: { ...sel, name: true } }),
    db.product.findMany({ select: { ...sel, name: true } }),
    db.review.findMany({ select: { ...sel, name: true } }),
    getSeo(),
    db.redirect.count(),
  ]);
  const all: Row[] = [
    ...pages.map((r) => ({ ...r, table: "page" as const, type: "Pagina", edit: `/admin/paginas/${r.id}/bewerken/` })),
    ...posts.map((r) => ({ ...r, table: "post" as const, type: "Blog", noindex: false, edit: `/admin/blogs/${r.id}/bewerken/` })),
    ...cats.map((r) => ({ ...r, title: r.name, table: "category" as const, type: "Categorie", noindex: false, edit: `/admin/shop/categorieen/${r.id}/bewerken/` })),
    ...products.map((r) => ({ ...r, title: r.name, table: "product" as const, type: "Product", noindex: false, edit: `/admin/shop/producten/${r.id}/bewerken/` })),
    ...reviews.map((r) => ({ ...r, title: r.name, table: "review" as const, type: "Review", noindex: false, edit: `/admin/reviews/${r.id}/bewerken/` })),
  ];
  const seen = new Map<string, number>();
  for (const r of all) if (r.metaTitle) seen.set(r.metaTitle, (seen.get(r.metaTitle) ?? 0) + 1);
  const dupes = new Set([...seen].filter(([, n]) => n > 1).map(([t]) => t));
  const q = (sp.q ?? "").toLowerCase();
  const rows = all
    .filter((r) => !sp.type || r.table === sp.type)
    .filter((r) => !sp.probleem || ISSUES[sp.probleem]?.test(r, dupes))
    .filter((r) => !q || r.title.toLowerCase().includes(q) || r.path.includes(q))
    .sort((a, b) => a.path.localeCompare(b.path));
  const page = Math.max(1, Number(sp.pagina) || 1);
  const pages_ = Math.max(1, Math.ceil(rows.length / PER));
  const shown = rows.slice((page - 1) * PER, page * PER);
  const count = (k: string) => all.filter((r) => ISSUES[k].test(r, dupes)).length;
  const qs = (p: Record<string, string | undefined>) => `?${new URLSearchParams(Object.entries({ ...sp, ...p }).filter(([, v]) => v) as [string, string][])}`;
  const filled = all.filter((r) => r.metaDescription).length;

  return (
    <>
      <PageHeader title="SEO-overzicht" description="Alle URL's van de website met meta-title en meta-description. Vind ontbrekende of te lange teksten en pas ze direct aan." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="URL's" value={all.length} sub={`${redirects} redirects actief`} />
        <Stat label="Met eigen description" value={`${Math.round((filled / all.length) * 100)}%`} sub={`${filled} van ${all.length}`} />
        <Stat label="Description ontbreekt" value={count("desc-leeg")} href={`/admin/seo/${qs({ probleem: "desc-leeg", pagina: undefined })}`} sub="valt terug op de eerste zin" />
        <Stat label="Dubbele titels" value={count("dubbel")} href={`/admin/seo/${qs({ probleem: "dubbel", pagina: undefined })}`} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <form action="/admin/seo/" className="mb-3 flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-white p-4" role="search">
            <input name="q" defaultValue={sp.q} placeholder="Zoek op titel of URL" type="search" className={`${input} min-w-[180px] flex-1`} aria-label="Zoeken" />
            <select name="type" defaultValue={sp.type ?? ""} className={`${input} !w-auto`} aria-label="Type">
              <option value="">Alle typen</option>
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <select name="probleem" defaultValue={sp.probleem ?? ""} className={`${input} !w-auto`} aria-label="Probleem">
              <option value="">Alle URL&apos;s</option>
              {Object.entries(ISSUES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label} ({count(k)})
                </option>
              ))}
            </select>
            <button className={btn}>Filter</button>
            {(sp.q || sp.type || sp.probleem) && (
              <Link href="/admin/seo/" className="text-sm underline">
                Wissen
              </Link>
            )}
          </form>
          <div className="overflow-x-auto rounded-2xl border border-line bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-xs uppercase tracking-wider text-ink-soft">
                <tr>
                  <th className="px-4 py-3 font-medium">URL</th>
                  <th className="px-4 py-3 font-medium">Meta-title en -description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {shown.map((r) => (
                  <tr key={`${r.table}-${r.id}`} className="align-top hover:bg-cream/60">
                    <td className="px-4 py-3">
                      <Link href={r.edit} className="font-medium hover:underline">
                        {r.title}
                      </Link>
                      <a href={r.path} target="_blank" className="block font-mono text-xs text-ink-soft hover:underline">
                        {r.path}
                      </a>
                      <span className="mt-1 flex flex-wrap gap-1">
                        <Badge>{r.type}</Badge>
                        {r.status === "draft" && <Badge tone="warning">concept</Badge>}
                        {r.noindex && <Badge tone="warning">noindex</Badge>}
                        {r.metaTitle && dupes.has(r.metaTitle) && <Badge tone="danger">dubbele titel</Badge>}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <MetaQuickEdit action={saveMeta.bind(null, r.table, r.id)} metaTitle={r.metaTitle} metaDescription={r.metaDescription} fallbackTitle={r.title} readOnly={!can(user, "editor")} />
                    </td>
                  </tr>
                ))}
                {!shown.length && (
                  <tr>
                    <td colSpan={2} className="px-4 py-10 text-center text-ink-soft">
                      Niets gevonden — mooi zo.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-3 flex flex-wrap gap-3 text-sm text-ink-soft">
            {rows.length} URL&apos;s · pagina {page} van {pages_}
            {page > 1 && (
              <Link href={`/admin/seo/${qs({ pagina: String(page - 1) })}`} className="underline">
                Vorige
              </Link>
            )}
            {page < pages_ && (
              <Link href={`/admin/seo/${qs({ pagina: String(page + 1) })}`} className="underline">
                Volgende
              </Link>
            )}
          </p>
        </div>

        <aside className="space-y-6">
          <Panel title="Algemene SEO-instellingen">
            <SimpleForm action={saveSeoSettings} readOnly={!can(user, "admin")}>
              <Field label="Google Search Console" hint="(verificatiecode of de hele metatag)">
                <input name="googleVerification" defaultValue={seo.googleVerification} className={`${input} font-mono text-xs`} />
              </Field>
              <Field label="Bing Webmaster Tools" hint="(msvalidate.01)">
                <input name="bingVerification" defaultValue={seo.bingVerification} className={`${input} font-mono text-xs`} />
              </Field>
              <Field label="Extra uitsluiten in robots.txt" hint="(één pad per regel)">
                <textarea name="robotsDisallow" defaultValue={seo.robotsDisallow.join("\n")} rows={3} placeholder="/zoeken/" className={`${input} font-mono text-xs`} />
              </Field>
            </SimpleForm>
          </Panel>
          <Panel title="Handig">
            <ul className="space-y-2 text-sm">
              <li>
                <a href="/sitemap_index.xml" target="_blank" className="underline">
                  XML-sitemap (sitemap_index.xml) ↗
                </a>
              </li>
              <li>
                <a href="/robots.txt" target="_blank" className="underline">
                  robots.txt ↗
                </a>
              </li>
              <li>
                <Link href="/admin/redirects/" className="underline">
                  Redirects beheren
                </Link>
              </li>
              <li>
                <a href="/api/admin/export/?type=seo&format=csv" className="underline">
                  Alle meta-gegevens exporteren (Excel/CSV)
                </a>
                <span className="block text-xs text-ink-soft">Aanpassen in Excel en terugzetten via Import / export.</span>
              </li>
            </ul>
          </Panel>
        </aside>
      </div>
    </>
  );
}
