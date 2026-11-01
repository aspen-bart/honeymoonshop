import "server-only";
import { allRoutes } from "./content";
import { db } from "./db";
import { images } from "./json";
import { canonical } from "./seo";
import { SITE_URL } from "./settings";

// Sitemaps in dezelfde opbouw als de oude Yoast-site (sitemap_index.xml + één sitemap per type).
// Alleen indexeerbare, gepubliceerde URL's; lastmod = echte wijzigingsdatum; geen changefreq/priority.

export const SITEMAPS = ["page", "post", "dress", "suit", "product", "real-brides", "category", "product_cat", "dress_cat", "suit_cat"] as const;
export type SitemapType = (typeof SITEMAPS)[number];

type Entry = { path: string; lastmod: Date; images?: string[] };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function entries(type: SitemapType): Promise<Entry[]> {
  const r = await allRoutes();
  switch (type) {
    case "page": {
      const home = await db.page.findUnique({ where: { path: "/" } });
      return r.pages.filter((p) => p.template !== "listing" || ["/trouwjurken/", "/pakken/", "/blog/", "/real-brides/"].includes(p.path)).map((p) => ({ path: p.path, lastmod: p.path === "/" && home ? home.updatedAt : p.updatedAt }));
    }
    case "post": {
      const posts = await db.post.findMany({ where: { status: "published" }, select: { path: true, updatedAt: true, heroImage: true }, orderBy: { publishedAt: "desc" } });
      return posts.map((p) => ({ path: p.path, lastmod: p.updatedAt, images: p.heroImage ? [p.heroImage] : [] }));
    }
    case "dress":
    case "suit":
    case "product": {
      const kind = type === "product" ? "accessory" : type;
      const list = await db.product.findMany({ where: { status: "published", kind }, select: { path: true, updatedAt: true, images: true }, orderBy: { sortOrder: "asc" } });
      return list.map((p) => ({ path: p.path, lastmod: p.updatedAt, images: images(p.images).map((i) => i.src) }));
    }
    case "real-brides":
      return r.reviews.map((p) => ({ path: p.path, lastmod: p.updatedAt }));
    case "category":
      return r.blogCats.map((c) => ({ path: `/blog/${c.slug}/`, lastmod: c.updatedAt }));
    case "product_cat":
      return r.categories.filter((c) => c.kind === "accessory").map((c) => ({ path: c.path, lastmod: c.updatedAt }));
    case "dress_cat":
      return r.categories.filter((c) => c.kind === "dress").map((c) => ({ path: c.path, lastmod: c.updatedAt }));
    case "suit_cat":
      return r.categories.filter((c) => c.kind === "suit").map((c) => ({ path: c.path, lastmod: c.updatedAt }));
  }
}

export async function sitemapXml(type: SitemapType) {
  const list = await entries(type);
  const urls = list
    .map((e) => `<url><loc>${esc(canonical(e.path))}</loc><lastmod>${e.lastmod.toISOString()}</lastmod>${(e.images ?? []).map((i) => `<image:image><image:loc>${esc(SITE_URL + i)}</image:loc></image:image>`).join("")}</url>`)
    .join("\n");
  return xml(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls}\n</urlset>`);
}

export async function sitemapIndexXml() {
  const parts = await Promise.all(
    SITEMAPS.map(async (t) => {
      const list = await entries(t);
      if (!list.length) return "";
      const last = list.reduce((a, b) => (a > b.lastmod ? a : b.lastmod), new Date(0));
      return `<sitemap><loc>${SITE_URL}/${t}-sitemap.xml</loc><lastmod>${last.toISOString()}</lastmod></sitemap>`;
    }),
  );
  return xml(`<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${parts.filter(Boolean).join("\n")}\n</sitemapindex>`);
}

function xml(body: string) {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n${body}`, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
