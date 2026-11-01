import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { PostCard } from "@/components/site/blocks";
import { ProductCard } from "@/components/site/ProductCard";
import { JsonLd } from "@/components/site/JsonLd";
import { db } from "@/lib/db";
import { breadcrumbLd, buildMetadata, graph } from "@/lib/seo";

// Zoekfunctie (ook gebruikt als SearchAction in de structured data). Zoekresultaten worden niet geïndexeerd.
export const metadata: Metadata = buildMetadata({ title: "Zoeken in trouwjurken, trouwpakken en blogs | Honeymoon shop", description: "Zoek in alle trouwjurken, trouwpakken, bruidsaccessoires en blogs van de Honeymoon shop in Rotterdam en vind snel jouw droomlook voor de grote dag.", path: "/zoeken/", noindex: true });

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? "").trim().slice(0, 80);
  const where = q ? { contains: q } : undefined;
  const [products, posts, pages] = q
    ? await Promise.all([
        db.product.findMany({ where: { status: "published", OR: [{ name: where }, { brand: { name: where } }, { articleNumber: where }] }, include: { brand: true }, take: 24, orderBy: { sortOrder: "asc" } }),
        db.post.findMany({ where: { status: "published", OR: [{ title: where }, { excerpt: where }] }, include: { category: true }, take: 6, orderBy: { publishedAt: "desc" } }),
        db.page.findMany({ where: { status: "published", noindex: false, title: where }, take: 8, select: { path: true, title: true } }),
      ])
    : [[], [], []];
  const total = products.length + posts.length + pages.length;
  return (
    <>
      <section className="bg-cream">
        <div className="container-x pb-10 pt-8">
          <Breadcrumbs items={[{ name: "Zoeken", path: "/zoeken/" }]} />
          <h1 className="mt-8 text-5xl sm:text-6xl">{q ? <>Zoekresultaten voor “{q}”</> : "Waar ben je naar op zoek?"}</h1>
          <form action="/zoeken/" role="search" className="mt-8 flex max-w-2xl gap-3">
            <label htmlFor="q" className="sr-only">
              Zoekterm
            </label>
            <input id="q" name="q" type="search" defaultValue={q} placeholder="Bijv. kant, Ladybird, blauw trouwpak" className="field" />
            <button className="btn-primary shrink-0">Zoeken</button>
          </form>
        </div>
      </section>
      <section className="container-x space-y-14 py-12">
        {q && total === 0 && (
          <p className="text-lg text-ink-soft">
            Niets gevonden. Bekijk de <Link href="/trouwjurken/" className="link">trouwjurken</Link>, de <Link href="/pakken/" className="link">trouwpakken</Link> of <Link href="/contact/" className="link">stel je vraag</Link>.
          </p>
        )}
        {products.length > 0 && (
          <div>
            <h2 className="mb-6 text-3xl">Collectie ({products.length})</h2>
            <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
              {products.map((p) => (
                <ProductCard key={p.id} p={p} />
              ))}
            </div>
          </div>
        )}
        {pages.length > 0 && (
          <div>
            <h2 className="mb-4 text-3xl">Pagina&apos;s</h2>
            <ul className="flex flex-wrap gap-2">
              {pages.map((p) => (
                <li key={p.path}>
                  <Link href={p.path} className="inline-block rounded-full border border-line px-4 py-2 hover:border-ink">
                    {p.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        {posts.length > 0 && (
          <div>
            <h2 className="mb-6 text-3xl">Blogs</h2>
            <div className="grid gap-10 md:grid-cols-3">
              {posts.map((p) => (
                <PostCard key={p.id} post={p} />
              ))}
            </div>
          </div>
        )}
      </section>
      <JsonLd data={graph(breadcrumbLd([{ name: "Zoeken", path: "/zoeken/" }]))} />
    </>
  );
}
