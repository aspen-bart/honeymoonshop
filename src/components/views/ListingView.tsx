import Link from "next/link";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { CtaBand, FaqList } from "@/components/site/blocks";
import { GarmentBrowser, type BrowserItem } from "@/components/site/GarmentBrowser";
import { Html } from "@/components/site/Html";
import { JsonLd } from "@/components/site/JsonLd";
import { FILTERS, garments } from "@/lib/content";
import { db } from "@/lib/db";
import type { Faq } from "@/lib/json";
import { breadcrumbLd, faqLd, graph, itemListLd, type Crumb } from "@/lib/seo";

// Overzicht van trouwjurken of trouwpakken: de hoofdpagina, een collectie (bv. /trouwjurken/big-sale/)
// of een filterpagina van de dressfinder (bv. /trouwjurken/kant/).
export async function ListingView(props: {
  kind: "dress" | "suit";
  path: string;
  title: string;
  introHtml?: string;
  bottomHtml?: string;
  faqs?: Faq[];
  onlyPaths?: string[];
  initial?: { group: string; value: string } | null;
  crumbs: Crumb[];
}) {
  const all = await garments(props.kind);
  const list = props.onlyPaths ? all.filter((p) => props.onlyPaths!.includes(p.path)) : all;
  const items: BrowserItem[] = list.map((p) => ({
    id: p.id,
    path: p.path,
    name: p.name,
    kind: p.kind,
    images: p.images,
    priceText: p.priceText,
    price: p.price,
    priceMin: p.priceMin,
    sale: p.sale,
    brand: p.brand ? { name: p.brand.name } : null,
    attributes: JSON.parse(p.attributes || "{}"),
    publishedAt: p.publishedAt.toISOString(),
  }));
  const collections = await db.category.findMany({ where: { kind: props.kind, status: "published" }, orderBy: { sortOrder: "asc" }, select: { path: true, name: true } });
  const base = props.kind === "dress" ? { path: "/trouwjurken/", label: "Alle trouwjurken" } : { path: "/pakken/", label: "Alle trouwpakken" };
  const kindLabel = props.kind === "dress" ? "trouwjurken" : "trouwpakken";
  // Filterpagina's tonen de geselecteerde subset; de lijst-data blijft compleet zodat filters combineren.
  const browserItems = props.initial ? items : items;

  return (
    <>
      <section className="bg-cream">
        <div className="container-x pb-10 pt-8 lg:pb-12">
          <Breadcrumbs items={props.crumbs} />
          <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_1fr] lg:items-end">
            <h1 className="text-5xl sm:text-6xl lg:text-7xl">{props.title}</h1>
            {props.introHtml && <Html html={props.introHtml} className="text-ink-2" />}
          </div>
          <nav aria-label="Collecties" className="no-scrollbar -mx-4 mt-8 flex gap-2 overflow-x-auto px-4">
            {[{ path: base.path, name: base.label }, ...collections].map((c) => (
              <Link key={c.path} href={c.path} aria-current={c.path === props.path ? "page" : undefined} className={`shrink-0 rounded-full border px-4 py-2 text-sm transition ${c.path === props.path ? "border-ink bg-ink text-white" : "border-ink/20 bg-white hover:border-ink"}`}>
                {c.name}
              </Link>
            ))}
          </nav>
        </div>
      </section>

      <section className="container-x py-10 lg:py-14">
        <GarmentBrowser items={browserItems} groups={FILTERS[props.kind]} initial={props.initial} kindLabel={kindLabel} />
      </section>

      {(props.bottomHtml || (props.faqs && props.faqs.length > 0)) && (
        <section className="border-t border-line bg-cream py-16 lg:py-20">
          <div className="container-x grid gap-12 lg:grid-cols-12">
            {props.bottomHtml && <Html html={props.bottomHtml} className={props.faqs?.length ? "lg:col-span-7" : "mx-auto max-w-3xl lg:col-span-12"} />}
            {props.faqs && props.faqs.length > 0 && (
              <div className={props.bottomHtml ? "lg:col-span-4 lg:col-start-9" : "lg:col-span-8"}>
                <h2 className="mb-6 text-4xl">Veelgestelde vragen</h2>
                <FaqList items={props.faqs} />
              </div>
            )}
          </div>
        </section>
      )}

      <CtaBand
        title={props.kind === "dress" ? "Jouw favorieten passen?" : "Het perfecte pak passen?"}
        text={props.kind === "dress" ? "Bewaar je favoriete jurken met het hartje en neem ze mee naar je pasafspraak. Wij zetten ze voor je klaar." : "Plan je afspraak in onze Men's shop — samen met de bruid kan ook."}
        primary={{ href: props.kind === "dress" ? "/afspraak-maken/trouwjurk-passen/" : "/afspraak-maken/trouwpak-passen/", label: "Plan je pasafspraak" }}
        secondary={{ href: "/favorieten/", label: "Mijn favorieten" }}
      />
      <JsonLd data={graph(breadcrumbLd(props.crumbs), itemListLd(props.title, (props.onlyPaths || props.initial ? items.filter((i) => !props.initial || i.attributes[props.initial.group]?.includes(props.initial.value)) : items).slice(0, 100).map((i) => ({ name: i.name, path: i.path }))), props.faqs?.length ? faqLd(props.faqs) : null)} />
    </>
  );
}
