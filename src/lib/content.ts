import "server-only";
import { cache } from "react";
import type { BlogCategory, Brand, Category, Page, Post, Product, Review } from "@prisma/client";
import { db } from "./db";
import filtersJson from "../../content/filters.json";

// Zoekt bij een URL-pad de bijbehorende content. Alle publieke URL's van de oude site lopen via deze resolver,
// zodat de URL-structuur (inclusief afwijkende paden als /bruid/stola/ en /accessoires-bruid/...) behouden blijft.

export type FilterGroup = { name: string; terms: { name: string; slug: string }[] };
export const FILTERS = filtersJson as { dress: FilterGroup[]; suit: FilterGroup[] };

export const PER_PAGE = { blog: 12, reviews: 24 };

const published = { status: "published" };

export type ProductWithBrand = Product & { brand: Brand | null };
export type ProductFull = Product & { brand: Brand | null; categories: Category[] };

export type Resolved =
  | { type: "page"; page: Page }
  | { type: "garment"; product: ProductFull }
  | { type: "accessory"; product: ProductFull }
  | { type: "collection"; category: Category; kind: "dress" | "suit" }
  | { type: "filter"; kind: "dress" | "suit"; group: string; term: { name: string; slug: string } }
  | { type: "accessoryCategory"; category: Category & { parent: Category | null; children: Category[] } }
  | { type: "post"; post: Post & { category: BlogCategory | null } }
  | { type: "blog"; page: number; category: BlogCategory | null }
  | { type: "reviews"; page: number }
  | { type: "review"; review: Review };

export const normalize = (path: string) => {
  let p = decodeURIComponent(path).toLowerCase();
  if (!p.startsWith("/")) p = `/${p}`;
  if (!p.endsWith("/")) p += "/";
  return p;
};

export const resolvePath = cache(async (rawPath: string, opts: { preview?: boolean } = {}): Promise<Resolved | null> => {
  const path = normalize(rawPath);
  const status = opts.preview ? {} : published;
  const parts = path.split("/").filter(Boolean);

  // Paginering: /blog/page/2/, /blog/bride-tips/page/2/, /real-brides/page/2/
  const pageMatch = /^(.*\/)page\/(\d+)\/$/.exec(path);
  if (pageMatch) {
    const n = Number(pageMatch[2]);
    if (n < 2) return null;
    const base = await resolvePath(pageMatch[1], opts);
    if (base?.type === "blog") return { ...base, page: n };
    if (base?.type === "reviews") return { type: "reviews", page: n };
    return null;
  }

  if (path === "/blog/") return { type: "blog", page: 1, category: null };
  if (path === "/real-brides/") return { type: "reviews", page: 1 };

  const page = await db.page.findFirst({ where: { path, ...status } });
  if (page && page.template !== "listing") return { type: "page", page };

  const product = await db.product.findFirst({ where: { path, ...status }, include: { brand: true, categories: true } });
  if (product) return product.kind === "accessory" ? { type: "accessory", product } : { type: "garment", product };

  const category = await db.category.findFirst({ where: { path, ...status }, include: { parent: true, children: { where: published, orderBy: { sortOrder: "asc" } } } });
  if (category) return category.kind === "accessory" ? { type: "accessoryCategory", category } : { type: "collection", category, kind: category.kind as "dress" | "suit" };

  if (parts[0] === "blog" && parts.length === 2) {
    const post = await db.post.findFirst({ where: { path, ...status }, include: { category: true } });
    if (post) return { type: "post", post };
    const blogCategory = await db.blogCategory.findUnique({ where: { slug: parts[1] } });
    if (blogCategory) return { type: "blog", page: 1, category: blogCategory };
  }
  if (parts[0] === "real-brides" && parts.length === 2) {
    const review = await db.review.findFirst({ where: { path, ...status } });
    if (review) return { type: "review", review };
  }
  // Blogs die (historisch) op het hoogste niveau staan
  if (parts.length === 1) {
    const post = await db.post.findFirst({ where: { path, ...status }, include: { category: true } });
    if (post) return { type: "post", post };
  }
  // Filterpagina's van de dressfinder (/trouwjurken/kant/, /pakken/blauw-trouwpak/)
  if ((parts[0] === "trouwjurken" || parts[0] === "pakken") && parts.length === 2) {
    const kind = parts[0] === "trouwjurken" ? "dress" : "suit";
    for (const g of FILTERS[kind]) {
      const term = g.terms.find((t) => t.slug === parts[1]);
      if (term) return { type: "filter", kind, group: g.name, term };
    }
  }
  if (page) return { type: "page", page };
  return null;
});

export const getListingPage = cache((path: string) => db.page.findUnique({ where: { path } }));

export const garments = cache((kind: "dress" | "suit") =>
  db.product.findMany({ where: { kind, ...published }, include: { brand: true }, orderBy: [{ sortOrder: "asc" }, { publishedAt: "desc" }] }),
);

export const featured = cache((kind: "dress" | "suit", take = 10) =>
  db.product.findMany({ where: { kind, featured: true, ...published }, include: { brand: true }, orderBy: [{ sortOrder: "asc" }], take }),
);

export async function relatedGarments(p: Product, take = 4) {
  const attrs = JSON.parse(p.attributes || "{}") as Record<string, string[]>;
  const sil = attrs["Silhouet"]?.[0] ?? attrs["Kleur"]?.[0];
  const pool = await db.product.findMany({ where: { kind: p.kind, id: { not: p.id }, ...published }, include: { brand: true }, orderBy: { sortOrder: "asc" }, take: 80 });
  const scored = pool
    .map((x) => {
      const a = JSON.parse(x.attributes || "{}") as Record<string, string[]>;
      let s = 0;
      if (x.brandId && x.brandId === p.brandId) s += 2;
      if (sil && (a["Silhouet"]?.includes(sil) || a["Kleur"]?.includes(sil))) s += 3;
      return { x, s };
    })
    .sort((a, b) => b.s - a.s);
  return scored.slice(0, take).map((s) => s.x);
}

export const latestPosts = cache((take = 3) => db.post.findMany({ where: published, orderBy: { publishedAt: "desc" }, take, include: { category: true } }));

export const featuredReviews = cache((take = 8) => db.review.findMany({ where: { ...published, featured: true }, orderBy: { publishedAt: "desc" }, take }));

export const accessoryRoots = cache(() =>
  db.category.findMany({ where: { kind: "accessory", ...published, parentId: null }, orderBy: { sortOrder: "asc" }, include: { children: { where: published, orderBy: { sortOrder: "asc" } } } }),
);

/** Alle indexeerbare publieke paden met hun echte wijzigingsdatum — bron voor sitemap én prerendering. */
export async function allRoutes() {
  const [pages, products, categories, posts, blogCats, reviews] = await Promise.all([
    db.page.findMany({ where: published, select: { path: true, updatedAt: true, noindex: true, template: true } }),
    db.product.findMany({ where: published, select: { path: true, updatedAt: true, kind: true } }),
    db.category.findMany({ where: published, select: { path: true, updatedAt: true, kind: true } }),
    db.post.findMany({ where: published, select: { path: true, updatedAt: true } }),
    db.blogCategory.findMany({ select: { slug: true, updatedAt: true, _count: { select: { posts: { where: published } } } } }),
    db.review.findMany({ where: published, select: { path: true, updatedAt: true }, orderBy: { publishedAt: "desc" } }),
  ]);
  const blogPages = Math.ceil(posts.length / PER_PAGE.blog);
  const reviewPages = Math.ceil(reviews.length / PER_PAGE.reviews);
  return {
    pages: pages.filter((p) => !p.noindex),
    noindexPages: pages.filter((p) => p.noindex),
    products,
    categories,
    posts,
    blogCats,
    reviews,
    paginated: [
      ...Array.from({ length: Math.max(0, blogPages - 1) }, (_, i) => `/blog/page/${i + 2}/`),
      ...Array.from({ length: Math.max(0, reviewPages - 1) }, (_, i) => `/real-brides/page/${i + 2}/`),
      ...blogCats.flatMap((c) => Array.from({ length: Math.max(0, Math.ceil(c._count.posts / PER_PAGE.blog) - 1) }, (_, i) => `/blog/${c.slug}/page/${i + 2}/`)),
    ],
  };
}
