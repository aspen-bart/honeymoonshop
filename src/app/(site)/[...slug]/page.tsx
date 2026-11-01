import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AccessoryCategoryView, AccessoryView } from "@/components/views/AccessoryViews";
import { BlogView, PostView, ReviewsView, ReviewView } from "@/components/views/ContentViews";
import { GarmentView } from "@/components/views/GarmentView";
import { ListingView } from "@/components/views/ListingView";
import { PageView } from "@/components/views/PageView";
import { allRoutes, getListingPage, resolvePath, type Resolved } from "@/lib/content";
import { crumbsFor } from "@/lib/crumbs";
import { db } from "@/lib/db";
import { faqs, images, parse } from "@/lib/json";
import { buildMetadata, describe, withBrand } from "@/lib/seo";

// Eén route voor alle publieke URL's van de oude site. Tijdens de build wordt elke URL ge-prerenderd
// (volledige HTML in de bron); nieuwe content uit het beheer wordt op aanvraag gerenderd en daarna gecachet
// (revalidatePath bij opslaan in /admin/).

type Props = { params: Promise<{ slug: string[] }> };

export const dynamicParams = true;

export async function generateStaticParams() {
  const r = await allRoutes();
  const paths = [
    ...r.pages.map((p) => p.path),
    ...r.noindexPages.map((p) => p.path),
    ...r.products.map((p) => p.path),
    ...r.categories.map((p) => p.path),
    ...r.posts.map((p) => p.path),
    ...r.blogCats.map((c) => `/blog/${c.slug}/`),
    ...r.reviews.map((p) => p.path),
    ...r.paginated,
    "/blog/",
    "/real-brides/",
  ].filter((p) => p !== "/");
  return [...new Set(paths)].map((p) => ({ slug: p.split("/").filter(Boolean) }));
}

const pathOf = (slug: string[]) => `/${slug.map(decodeURIComponent).join("/")}/`;

async function metaFor(r: Resolved, path: string): Promise<Metadata> {
  switch (r.type) {
    case "page": {
      const p = r.page;
      return buildMetadata({ title: p.metaTitle || withBrand(p.title), description: describe(p.metaDescription, p.html), path: p.path, image: p.ogImage || p.heroImage, noindex: p.noindex });
    }
    case "garment":
    case "accessory": {
      const p = r.product;
      return buildMetadata({ title: p.metaTitle || withBrand(p.name), description: describe(p.metaDescription, p.descriptionHtml), path: p.path, image: p.ogImage || images(p.images)[0]?.src });
    }
    case "collection":
    case "accessoryCategory": {
      const c = r.category;
      return buildMetadata({ title: c.metaTitle || withBrand(c.name), description: describe(c.metaDescription, c.introHtml || c.bottomHtml || `Bekijk ${c.name.toLowerCase()} bij de Honeymoon shop in Rotterdam.`), path: c.path, image: c.image });
    }
    case "filter": {
      const label = r.kind === "dress" ? "Trouwjurken" : "Trouwpakken";
      // Filterpagina's zijn navigatiehulpen: niet indexeren, wel links volgen (canonical-variant is het overzicht).
      return buildMetadata({ title: `${label}: ${r.term.name} | Honeymoon shop`, description: `Bekijk alle ${label.toLowerCase()} met ${r.group.toLowerCase()} ${r.term.name.toLowerCase()} bij de Honeymoon shop in Rotterdam en plan je pasafspraak.`, path, noindex: true });
    }
    case "post": {
      const p = r.post;
      return buildMetadata({ title: p.metaTitle || withBrand(p.title), description: describe(p.metaDescription, p.html), path: p.path, image: p.ogImage || p.heroImage, type: "article", publishedTime: p.publishedAt, modifiedTime: p.updatedAt });
    }
    case "blog": {
      const listing = await getListingPage("/blog/");
      const suffix = r.page > 1 ? ` – pagina ${r.page}` : "";
      if (r.category)
        return buildMetadata({ title: r.page > 1 ? `${(r.category.metaTitle || r.category.name).replace(/ ?[-|–] ?Honeymoon ?shop$/i, "")}${suffix} | Honeymoon shop` : r.category.metaTitle || withBrand(`${r.category.name} – blog`), description: r.page > 1 ? `Pagina ${r.page} van alle blogs over ${r.category.name.toLowerCase()}: tips, trends en inspiratie voor jullie bruiloft van team Honeymoon shop uit Rotterdam.` : describe(r.category.metaDescription, r.category.introHtml || `Alle blogs over ${r.category.name.toLowerCase()}: tips, trends en inspiratie voor jullie bruiloft van team Honeymoon shop uit Rotterdam.`), path });
      return buildMetadata({ title: r.page > 1 ? `Blog over trouwen en bruidsmode${suffix} | Honeymoon shop` : listing?.metaTitle || "Blog | Honeymoon shop", description: r.page > 1 ? `Pagina ${r.page} van de blog van de Honeymoon shop: tips over trouwjurken, trouwpakken, trends en het plannen van jullie bruiloft.` : describe(listing?.metaDescription, listing?.html), path });
    }
    case "reviews": {
      const listing = await getListingPage("/real-brides/");
      return buildMetadata({ title: r.page > 1 ? `Real Brides & Grooms – pagina ${r.page} | Honeymoon shop` : listing?.metaTitle || "Real Brides & Grooms | Honeymoon shop", description: r.page > 1 ? `Pagina ${r.page} met echte verhalen van bruiden en bruidegoms die hun trouwjurk of trouwpak vonden bij de Honeymoon shop in Rotterdam.` : describe(listing?.metaDescription, listing?.html), path });
    }
    case "review": {
      const v = r.review;
      return buildMetadata({ title: v.metaTitle || withBrand(`Real bride ${v.name}`), description: describe(v.metaDescription, v.html || `${v.name} vonden hun trouwlook bij de Honeymoon shop in Rotterdam. Lees hun verhaal en bekijk de foto's van hun trouwdag.`), path: v.path, image: v.image, type: "article" });
    }
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const path = pathOf((await params).slug);
  const r = await resolvePath(path);
  if (!r) return { title: "Pagina niet gevonden | Honeymoon shop", robots: { index: false } };
  return metaFor(r, path);
}

export default async function CatchAll({ params }: Props) {
  const path = pathOf((await params).slug);
  const r = await resolvePath(path);
  if (!r) notFound();

  switch (r.type) {
    case "page": {
      const p = r.page;
      if (p.template === "listing") {
        const data = parse<{ kind?: string; bottomHtml?: string }>(p.templateData, {});
        if (data.kind === "dress" || data.kind === "suit")
          return <ListingView kind={data.kind} path={p.path} title={p.title} introHtml={p.html} bottomHtml={data.bottomHtml} faqs={faqs(p.faqs)} crumbs={[{ name: p.title, path: p.path }]} />;
      }
      return <PageView page={p} />;
    }
    case "garment":
      return <GarmentView product={r.product} />;
    case "accessory":
      return <AccessoryView product={r.product} />;
    case "accessoryCategory":
      return <AccessoryCategoryView category={r.category} />;
    case "collection": {
      const c = r.category;
      const items = await db.product.findMany({ where: { categories: { some: { id: c.id } } }, select: { path: true } });
      return <ListingView kind={r.kind} path={c.path} title={c.name} introHtml={c.introHtml} bottomHtml={c.bottomHtml} onlyPaths={items.map((i) => i.path)} crumbs={await crumbsFor(c.path, c.name)} />;
    }
    case "filter": {
      const label = r.kind === "dress" ? "Trouwjurken" : "Trouwpakken";
      const title = `${label}: ${r.term.name}`;
      return (
        <ListingView
          kind={r.kind}
          path={path}
          title={title}
          introHtml={`<p>Alle ${label.toLowerCase()} in de categorie <strong>${r.term.name}</strong> (${r.group.toLowerCase()}). Combineer gerust met andere filters, of bekijk de <a href="${r.kind === "dress" ? "/trouwjurken/" : "/pakken/"}">volledige collectie ${label.toLowerCase()}</a>.</p>`}
          initial={{ group: r.group, value: r.term.name }}
          crumbs={await crumbsFor(path, r.term.name)}
        />
      );
    }
    case "post":
      return <PostView post={r.post} />;
    case "blog":
      return <BlogView page={r.page} category={r.category} />;
    case "reviews":
      return <ReviewsView page={r.page} />;
    case "review":
      return <ReviewView review={r.review} />;
  }
}

