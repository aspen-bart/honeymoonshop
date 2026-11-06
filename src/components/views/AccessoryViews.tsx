import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { CtaBand, SectionHead } from "@/components/site/blocks";
import { FavoriteButton } from "@/components/site/FavoriteButton";
import { Gallery } from "@/components/site/Gallery";
import { Html } from "@/components/site/Html";
import { JsonLd } from "@/components/site/JsonLd";
import { ProductCard } from "@/components/site/ProductCard";
import { accessoryRoots, type ProductFull } from "@/lib/content";
import { db } from "@/lib/db";
import { attributes, images } from "@/lib/json";
import { breadcrumbLd, describe, graph, itemListLd, productLd, type Crumb } from "@/lib/seo";
import { euro } from "@/lib/text";
import type { Category } from "@prisma/client";

/** Kruimelpad via de categorieboom (de oude productpaden volgen de boom niet altijd). */
async function categoryChain(cat: Category | null): Promise<Crumb[]> {
  const chain: Crumb[] = [];
  let cur = cat;
  for (let i = 0; cur && i < 5; i++) {
    chain.unshift({ name: cur.name, path: cur.path });
    cur = cur.parentId ? await db.category.findUnique({ where: { id: cur.parentId } }) : null;
  }
  return chain;
}

export async function AccessoryCategoryView({ category }: { category: Category & { parent: Category | null; children: Category[] } }) {
  const crumbs = await categoryChain(category);
  const [products, roots] = await Promise.all([
    db.product.findMany({ where: { kind: "accessory", status: "published", categories: { some: { id: { in: [category.id, ...category.children.map((c) => c.id)] } } } }, include: { brand: true }, orderBy: { sortOrder: "asc" } }),
    accessoryRoots(),
  ]);
  const siblings = category.parent ? await db.category.findMany({ where: { parentId: category.parentId, status: "published" }, orderBy: { sortOrder: "asc" } }) : [];
  const nav = category.children.length ? category.children : siblings;

  return (
    <>
      <section className="bg-cream">
        <div className="container-x pb-10 pt-8">
          <Breadcrumbs items={crumbs} />
          <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1fr] lg:items-end">
            <h1 className="text-5xl sm:text-6xl lg:text-7xl">{category.name}</h1>
            <Html html={category.introHtml} className="text-ink-2" />
          </div>
          {nav.length > 0 && (
            <nav aria-label="Subcategorieën" className="no-scrollbar -mx-4 mt-8 flex gap-2 overflow-x-auto px-4">
              {category.parent && (
                <Link href={category.parent.path} className="shrink-0 rounded-full border border-ink/20 bg-white px-4 py-2 text-sm hover:border-ink">
                  ← {category.parent.name}
                </Link>
              )}
              {nav.map((c) => (
                <Link key={c.id} href={c.path} aria-current={c.id === category.id ? "page" : undefined} className={`shrink-0 rounded-full border px-4 py-2 text-sm ${c.id === category.id ? "border-ink bg-ink text-white" : "border-ink/20 bg-white hover:border-ink"}`}>
                  {c.name}
                </Link>
              ))}
            </nav>
          )}
        </div>
      </section>

      <section className="container-x py-12">
        <p className="mb-6 text-sm text-ink-soft">
          <strong className="text-ink">{products.length}</strong> producten · bekijk ze in de winkel of vraag ernaar tijdens je pasafspraak
        </p>
        {products.length ? (
          <ul className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4">
            {products.map((p, i) => (
              <li key={p.id}>
                <ProductCard p={p} priority={i < 4} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl bg-cream p-8 text-center text-ink-soft">Deze categorie wordt aangevuld. Vraag in de winkel naar de actuele collectie.</p>
        )}
      </section>

      {category.bottomHtml && (
        <section className="border-t border-line bg-cream py-16">
          <Html html={category.bottomHtml} className="container-x max-w-3xl" />
        </section>
      )}

      <section className="container-x py-14">
        <h2 className="mb-6 text-3xl">Alle bruidsaccessoires</h2>
        <ul className="flex flex-wrap gap-2">
          {roots.flatMap((r) => [r, ...r.children]).map((c) => (
            <li key={c.id}>
              <Link href={c.path} className="inline-block rounded-full border border-line px-4 py-2 text-sm hover:border-ink">
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <CtaBand title="De finishing touch passen?" text="Combineer sluier, sieraden en haaraccessoires direct met je jurk tijdens je pasafspraak." />
      <JsonLd data={graph(breadcrumbLd(crumbs), itemListLd(category.name, products.map((p) => ({ name: p.name, path: p.path }))))} />
    </>
  );
}

export async function AccessoryView({ product }: { product: ProductFull }) {
  const primary = product.categories.find((c) => c.kind === "accessory") ?? null;
  const crumbs = [...(await categoryChain(primary)), { name: product.name, path: product.path }];
  const imgs = images(product.images);
  const related = primary
    ? await db.product.findMany({ where: { kind: "accessory", status: "published", id: { not: product.id }, categories: { some: { id: primary.id } } }, include: { brand: true }, take: 4, orderBy: { sortOrder: "asc" } })
    : [];
  return (
    <>
      <div className="container-x pt-6">
        <Breadcrumbs items={crumbs} />
      </div>
      <section className="container-x grid gap-10 py-8 lg:grid-cols-[1fr_1fr] lg:gap-16">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <Gallery images={imgs} name={product.name} />
        </div>
        <div>
          {product.brand && <p className="eyebrow text-lilac-700">{product.brand.name}</p>}
          <h1 className="mt-3 text-5xl sm:text-6xl">{product.name}</h1>
          {product.price != null && <p className="mt-4 font-serif text-3xl">{euro(product.price)}</p>}
          <Html html={product.descriptionHtml} className="mt-6" />
          {Object.keys(attributes(product.attributes)).length > 0 && (
            <dl className="mt-8 divide-y divide-line border-y border-line">
              {Object.entries(attributes(product.attributes)).map(([k, v]) => (
                <div key={k} className="grid grid-cols-[130px_1fr] gap-4 py-3 text-[0.95rem]">
                  <dt className="text-ink-soft">{k}</dt>
                  <dd>{v.join(', ')}</dd>
                </div>
              ))}
            </dl>
          )}
          <div className="mt-6 rounded-2xl bg-lilac-100 p-5 text-[0.95rem]">
            <p className="flex items-center gap-2 font-medium">
              <Icon name="info" className="h-5 w-5 text-lilac-700" /> Verkrijgbaar in onze winkel
            </p>
            <p className="mt-1 text-ink-soft">Online afrekenen is niet mogelijk. Reserveer dit product via een vraag of bekijk het tijdens je pasafspraak, dan leggen we het voor je klaar.</p>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Link href={`/contact/?over=${encodeURIComponent(product.path)}`} className="btn-primary">
              <Icon name="mail" className="h-4 w-4" /> Reserveer of stel een vraag
            </Link>
            <FavoriteButton item={{ path: product.path, name: product.name, image: imgs[0]?.src ?? null, kind: "accessory" }} withLabel className="btn-ghost justify-center" />
          </div>
          <ul className="mt-8 space-y-2 text-[0.95rem]">
            {["Ruim assortiment bruidsaccessoires", "Altijd de laatste trends", "Exclusieve merken en designs", "Persoonlijk advies bij je jurk"].map((t) => (
              <li key={t} className="flex gap-2">
                <Icon name="check" className="mt-0.5 h-5 w-5 text-success" /> {t}
              </li>
            ))}
          </ul>
          {primary && (
            <p className="mt-6 text-sm text-ink-soft">
              Meer in{" "}
              <Link href={primary.path} className="link">
                {primary.name.toLowerCase()}
              </Link>{" "}
              of bekijk{" "}
              <Link href="/bruid/accessoires/" className="link">
                alle bruidsaccessoires
              </Link>
              .
            </p>
          )}
        </div>
      </section>
      {related.length > 0 && (
        <section className="bg-cream py-16">
          <div className="container-x">
            <SectionHead title="Ook mooi bij je look" />
            <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
              {related.map((p) => (
                <ProductCard key={p.id} p={p} />
              ))}
            </div>
          </div>
        </section>
      )}
      <CtaBand />
      <JsonLd
        data={graph(
          productLd({ name: product.name, path: product.path, description: describe(product.metaDescription, product.descriptionHtml), images: imgs.map((i) => i.src), sku: product.sku, brand: product.brand?.name, price: product.price, category: primary?.name }),
          breadcrumbLd(crumbs),
        )}
      />
    </>
  );
}
