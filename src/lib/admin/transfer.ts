import "server-only";
import { db } from "../db";
import { parse } from "../json";
import { cleanHtml } from "./sanitize";
import { normalizePath } from "./common";

// Import en export voor /admin/import-export/.
// - JSON: volledige content per type (of alles in één back-up), terug te importeren op dezelfde of een andere omgeving.
// - CSV (puntkomma, UTF-8 met BOM, opent direct goed in Excel): om te bewerken en terug te zetten voor
//   redirects, SEO (meta-title/description per URL) en prijzen. Overige typen exporteren als CSV-overzicht.
// Gebruikers (wachtwoorden) en connecties (API-sleutels) worden nooit geëxporteerd.

export const EXPORT_TYPES = {
  posts: { label: "Blogs", importable: "json" },
  pages: { label: "Pagina's", importable: "json" },
  products: { label: "Producten (jurken, pakken, accessoires)", importable: "json" },
  categories: { label: "Categorieën en collecties", importable: "json" },
  reviews: { label: "Reviews (real brides)", importable: "json" },
  brands: { label: "Merken", importable: "json" },
  redirects: { label: "Redirects", importable: "json+csv" },
  seo: { label: "SEO: meta-gegevens van alle URL's", importable: "csv" },
  prices: { label: "Prijzen", importable: "csv" },
  appointments: { label: "Afspraken", importable: "" },
  messages: { label: "Berichten", importable: "" },
  tickets: { label: "Tickets", importable: "" },
  media: { label: "Mediabibliotheek (lijst)", importable: "" },
} as const;
export type ExportType = keyof typeof EXPORT_TYPES;
const CONTENT_TYPES = ["brands", "categories", "products", "pages", "posts", "reviews", "redirects"] as const;

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

export async function exportItems(type: ExportType): Promise<Record<string, unknown>[]> {
  switch (type) {
    case "posts":
      return (await db.post.findMany({ include: { category: true }, orderBy: { publishedAt: "desc" } })).map((p) => ({
        path: p.path,
        slug: p.slug,
        title: p.title,
        excerpt: p.excerpt,
        html: p.html,
        heroImage: p.heroImage,
        heroAlt: p.heroAlt,
        category: p.category ? { slug: p.category.slug, name: p.category.name } : null,
        authorName: p.authorName,
        status: p.status,
        metaTitle: p.metaTitle,
        metaDescription: p.metaDescription,
        ogImage: p.ogImage,
        publishedAt: iso(p.publishedAt),
        updatedAt: iso(p.updatedAt),
      }));
    case "pages":
      return (await db.page.findMany({ orderBy: { path: "asc" } })).map((p) => ({
        path: p.path,
        title: p.title,
        template: p.template,
        templateData: parse(p.templateData, {}),
        html: p.html,
        heroImage: p.heroImage,
        heroAlt: p.heroAlt,
        faqs: parse(p.faqs, []),
        status: p.status,
        noindex: p.noindex,
        metaTitle: p.metaTitle,
        metaDescription: p.metaDescription,
        ogImage: p.ogImage,
        publishedAt: iso(p.publishedAt),
        updatedAt: iso(p.updatedAt),
      }));
    case "products":
      return (await db.product.findMany({ include: { brand: true, categories: { select: { path: true } } }, orderBy: [{ kind: "asc" }, { name: "asc" }] })).map((p) => ({
        kind: p.kind,
        path: p.path,
        slug: p.slug,
        name: p.name,
        brand: p.brand?.name ?? null,
        articleNumber: p.articleNumber,
        sku: p.sku,
        descriptionHtml: p.descriptionHtml,
        priceText: p.priceText,
        priceMin: p.priceMin,
        priceMax: p.priceMax,
        price: p.price,
        images: parse(p.images, []),
        attributes: parse(p.attributes, {}),
        categories: p.categories.map((c) => c.path),
        sale: p.sale,
        featured: p.featured,
        status: p.status,
        sortOrder: p.sortOrder,
        tryOn: parse(p.tryOn, null),
        metaTitle: p.metaTitle,
        metaDescription: p.metaDescription,
        ogImage: p.ogImage,
        publishedAt: iso(p.publishedAt),
      }));
    case "categories":
      return (await db.category.findMany({ include: { parent: { select: { path: true } } }, orderBy: [{ kind: "asc" }, { sortOrder: "asc" }] })).map((c) => ({
        kind: c.kind,
        path: c.path,
        name: c.name,
        parent: c.parent?.path ?? null,
        introHtml: c.introHtml,
        bottomHtml: c.bottomHtml,
        image: c.image,
        sortOrder: c.sortOrder,
        status: c.status,
        metaTitle: c.metaTitle,
        metaDescription: c.metaDescription,
      }));
    case "reviews":
      return (await db.review.findMany({ orderBy: { publishedAt: "desc" } })).map((r) => ({
        path: r.path,
        slug: r.slug,
        name: r.name,
        html: r.html,
        image: r.image,
        gallery: parse(r.gallery, []),
        photographer: r.photographer,
        productPaths: parse(r.productPaths, []),
        rating: r.rating,
        featured: r.featured,
        status: r.status,
        metaTitle: r.metaTitle,
        metaDescription: r.metaDescription,
        weddingDate: iso(r.weddingDate),
        publishedAt: iso(r.publishedAt),
      }));
    case "brands":
      return (await db.brand.findMany({ orderBy: [{ kind: "asc" }, { name: "asc" }] })).map((b) => ({ kind: b.kind, slug: b.slug, name: b.name, logo: b.logo }));
    case "redirects":
      return (await db.redirect.findMany({ orderBy: { from: "asc" } })).map((r) => ({ from: r.from, to: r.to, status: r.status, hits: r.hits }));
    case "seo": {
      const sel = { path: true, metaTitle: true, metaDescription: true } as const;
      const [pages, posts, products, cats, reviews] = await Promise.all([
        db.page.findMany({ select: { ...sel, title: true, status: true } }),
        db.post.findMany({ select: { ...sel, title: true, status: true } }),
        db.product.findMany({ select: { ...sel, name: true, status: true } }),
        db.category.findMany({ select: { ...sel, name: true, status: true } }),
        db.review.findMany({ select: { ...sel, name: true, status: true } }),
      ]);
      const row = (type: string, title: string, r: { path: string; metaTitle: string | null; metaDescription: string | null; status: string }) => ({ type, path: r.path, title, status: r.status, metaTitle: r.metaTitle ?? "", metaDescription: r.metaDescription ?? "" });
      return [...pages.map((r) => row("pagina", r.title, r)), ...posts.map((r) => row("blog", r.title, r)), ...cats.map((r) => row("categorie", r.name, r)), ...products.map((r) => row("product", r.name, r)), ...reviews.map((r) => row("review", r.name, r))].sort((a, b) => a.path.localeCompare(b.path));
    }
    case "prices":
      return (await db.product.findMany({ include: { brand: true }, orderBy: [{ kind: "asc" }, { name: "asc" }] })).map((p) => ({ path: p.path, name: p.name, kind: p.kind, brand: p.brand?.name ?? "", priceText: p.priceText ?? "", priceMin: p.priceMin ?? "", priceMax: p.priceMax ?? "", price: p.price ?? "", sale: p.sale ? "ja" : "nee" }));
    case "appointments":
      return (await db.appointment.findMany({ orderBy: [{ date: "desc" }, { time: "desc" }] })).map((a) => ({ datum: a.date, tijd: a.time, type: a.type, status: a.status, naam: a.name, email: a.email, telefoon: a.phone, trouwdatum: a.weddingDate, gezelschap: a.companions, budget: a.budget, opmerkingen: a.notes, favorieten: parse<string[]>(a.favorites, []).join(" "), bron: a.source, notitie: a.internalNote, aangemaakt: iso(a.createdAt) }));
    case "messages":
      return (await db.contactMessage.findMany({ orderBy: { createdAt: "desc" } })).map((m) => ({ datum: iso(m.createdAt), naam: m.name, email: m.email, telefoon: m.phone, onderwerp: m.subject, bericht: m.message, over: m.about, afgehandeld: m.handled ? "ja" : "nee" }));
    case "tickets":
      return (await db.ticket.findMany({ orderBy: { number: "desc" } })).map((t) => ({ nummer: t.number, onderwerp: t.subject, type: t.type, prioriteit: t.priority, status: t.status, omschrijving: t.description, pagina: t.pageUrl, door: t.createdByName, pulseId: t.pulseId, aangemaakt: iso(t.createdAt) }));
    case "media":
      return (await db.media.findMany({ orderBy: { createdAt: "desc" } })).map((m) => ({ path: m.path, alt: m.alt, width: m.width, height: m.height, size: m.size, aangemaakt: iso(m.createdAt) }));
  }
}

export async function exportAll() {
  const data: Record<string, unknown[]> = {};
  for (const t of CONTENT_TYPES) data[t] = await exportItems(t);
  const settings = await db.setting.findMany({ where: { key: { not: "connections" } } });
  return { format: "honeymoonshop-export", version: 1, type: "full", exportedAt: new Date().toISOString(), data, settings: Object.fromEntries(settings.map((s) => [s.key, parse(s.value, null)])) };
}

// ---------- CSV ----------
export function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "﻿";
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const cell = (v: unknown) => {
    const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return `﻿${[cols.join(";"), ...rows.map((r) => cols.map((c) => cell(r[c])).join(";"))].join("\r\n")}`;
}

export function parseCsv(text: string): Record<string, string>[] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0];
  const sep = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      row.push(cur);
      cur = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
    } else cur += ch;
  }
  if (cur || row.length) {
    row.push(cur);
    rows.push(row);
  }
  const [head, ...body] = rows.filter((r) => r.some((c) => c.trim()));
  if (!head) return [];
  const keys = head.map((h) => h.trim());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()])));
}

// ---------- import ----------
type Result = { created: number; updated: number; skipped: number; errors: string[]; dryRun: boolean };
type Item = Record<string, unknown>;
const s = (v: unknown) => (v == null ? null : String(v));
const n = (v: unknown) => (v === "" || v == null || !Number.isFinite(Number(String(v).replace(",", "."))) ? null : Number(String(v).replace(",", ".")));
const d = (v: unknown) => (v ? new Date(String(v)) : undefined);
const j = (v: unknown, fallback: unknown) => JSON.stringify(typeof v === "string" ? parse(v, fallback) : (v ?? fallback));
const status = (v: unknown) => (v === "draft" ? "draft" : "published");

export async function importData(text: string, fileName: string, opts: { type: string; overwrite: boolean; dryRun: boolean }): Promise<Result> {
  const res: Result = { created: 0, updated: 0, skipped: 0, errors: [], dryRun: opts.dryRun };
  const isCsv = /\.csv$/i.test(fileName) || !text.trim().startsWith("{");
  if (isCsv) {
    const rows = parseCsv(text);
    const type = opts.type || (rows[0] && "metaDescription" in rows[0] ? "seo" : rows[0] && "from" in rows[0] ? "redirects" : rows[0] && "priceMin" in rows[0] ? "prices" : "");
    if (!["seo", "redirects", "prices"].includes(type)) throw new Error("CSV-import kan voor redirects, SEO en prijzen. Kies het type of gebruik een JSON-export.");
    for (const r of rows) await importRow(type, r, opts, res);
    return res;
  }
  const json = parse<{ format?: string; type?: string; items?: Item[]; data?: Record<string, Item[]>; settings?: Record<string, unknown> }>(text, {});
  if (json.format !== "honeymoonshop-export") throw new Error("Dit is geen exportbestand van deze website.");
  if (json.type === "full" && json.data) {
    for (const t of CONTENT_TYPES) for (const item of json.data[t] ?? []) await importRow(t, item, opts, res);
    if (json.settings && opts.overwrite && !opts.dryRun) for (const [key, value] of Object.entries(json.settings)) if (value != null && key !== "connections") await db.setting.upsert({ where: { key }, create: { key, value: JSON.stringify(value) }, update: { value: JSON.stringify(value) } });
    return res;
  }
  if (!json.type || !json.items) throw new Error("Het bestand bevat geen items.");
  for (const item of json.items) await importRow(json.type, item, opts, res);
  return res;
}

async function importRow(type: string, it: Item, opts: { overwrite: boolean; dryRun: boolean }, res: Result) {
  try {
    const key = type === "redirects" ? normalizePath(String(it.from ?? "")) : type === "brands" ? null : normalizePath(String(it.path ?? ""));
    if (type !== "brands" && !key) {
      res.skipped++;
      return;
    }
    const exists = await existing(type, key, it);
    if (exists && !opts.overwrite && !["seo", "prices"].includes(type)) {
      res.skipped++;
      return;
    }
    if (opts.dryRun) {
      if (exists) res.updated++;
      else if (["seo", "prices"].includes(type)) res.skipped++;
      else res.created++;
      return;
    }
    switch (type) {
      case "seo": {
        if (!exists) {
          res.skipped++;
          return;
        }
        const data = { metaTitle: s(it.metaTitle) || null, metaDescription: s(it.metaDescription) || null };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (db[exists.table as "page"] as any).update({ where: { id: exists.id }, data });
        break;
      }
      case "prices": {
        if (!exists) {
          res.skipped++;
          return;
        }
        await db.product.update({ where: { id: exists.id }, data: { priceText: s(it.priceText) || null, priceMin: n(it.priceMin), priceMax: n(it.priceMax), price: n(it.price), ...(it.sale != null && it.sale !== "" ? { sale: /^(ja|true|1|yes)$/i.test(String(it.sale)) } : {}) } });
        break;
      }
      case "redirects": {
        const to = String(it.to ?? "");
        await db.redirect.upsert({ where: { from: key! }, create: { from: key!, to, status: n(it.status) === 302 ? 302 : 301 }, update: { to, status: n(it.status) === 302 ? 302 : 301 } });
        break;
      }
      case "brands": {
        const data = { kind: String(it.kind), slug: String(it.slug), name: String(it.name), logo: s(it.logo) };
        await db.brand.upsert({ where: { kind_slug: { kind: data.kind, slug: data.slug } }, create: data, update: data });
        break;
      }
      case "posts": {
        const cat = it.category as { slug: string; name: string } | null;
        const category = cat?.slug ? await db.blogCategory.upsert({ where: { slug: cat.slug }, create: { slug: cat.slug, name: cat.name || cat.slug }, update: {} }) : null;
        const data = { path: key!, slug: String(it.slug || key!.split("/").filter(Boolean).pop()), title: String(it.title), excerpt: String(it.excerpt ?? ""), html: cleanHtml(String(it.html ?? "")), heroImage: s(it.heroImage), heroAlt: String(it.heroAlt ?? ""), categoryId: category?.id ?? null, authorName: String(it.authorName || "Team Honeymoon shop"), status: status(it.status), metaTitle: s(it.metaTitle), metaDescription: s(it.metaDescription), ogImage: s(it.ogImage), publishedAt: d(it.publishedAt) };
        await db.post.upsert({ where: { path: key! }, create: data, update: data });
        break;
      }
      case "pages": {
        const data = { path: key!, title: String(it.title), template: String(it.template || "default"), templateData: j(it.templateData, {}), html: cleanHtml(String(it.html ?? "")), heroImage: s(it.heroImage), heroAlt: String(it.heroAlt ?? ""), faqs: j(it.faqs, []), status: status(it.status), noindex: !!it.noindex, metaTitle: s(it.metaTitle), metaDescription: s(it.metaDescription), ogImage: s(it.ogImage), publishedAt: d(it.publishedAt) };
        await db.page.upsert({ where: { path: key! }, create: data, update: data });
        break;
      }
      case "categories": {
        const parent = it.parent ? await db.category.findUnique({ where: { path: String(it.parent) }, select: { id: true } }) : null;
        const data = { kind: String(it.kind || "accessory"), path: key!, name: String(it.name), introHtml: cleanHtml(String(it.introHtml ?? "")), bottomHtml: cleanHtml(String(it.bottomHtml ?? "")), image: s(it.image), parentId: parent?.id ?? null, sortOrder: n(it.sortOrder) ?? 0, status: status(it.status), metaTitle: s(it.metaTitle), metaDescription: s(it.metaDescription) };
        await db.category.upsert({ where: { path: key! }, create: data, update: data });
        break;
      }
      case "products": {
        const kind = String(it.kind || "dress");
        const brand = it.brand ? await db.brand.findFirst({ where: { kind, name: String(it.brand) }, select: { id: true } }) : null;
        const cats = await db.category.findMany({ where: { path: { in: (it.categories as string[] | undefined) ?? [] } }, select: { id: true } });
        const data = { kind, path: key!, slug: String(it.slug || key!.split("/").filter(Boolean).pop()), name: String(it.name), brandId: brand?.id ?? null, articleNumber: s(it.articleNumber), sku: s(it.sku), descriptionHtml: cleanHtml(String(it.descriptionHtml ?? "")), priceText: s(it.priceText), priceMin: n(it.priceMin), priceMax: n(it.priceMax), price: n(it.price), images: j(it.images, []), attributes: j(it.attributes, {}), sale: !!it.sale, featured: !!it.featured, status: status(it.status), sortOrder: n(it.sortOrder) ?? 0, tryOn: it.tryOn ? j(it.tryOn, null) : null, metaTitle: s(it.metaTitle), metaDescription: s(it.metaDescription), ogImage: s(it.ogImage), publishedAt: d(it.publishedAt) };
        await db.product.upsert({ where: { path: key! }, create: { ...data, categories: { connect: cats } }, update: { ...data, categories: { set: cats } } });
        break;
      }
      case "reviews": {
        const data = { path: key!, slug: String(it.slug || key!.split("/").filter(Boolean).pop()), name: String(it.name), html: cleanHtml(String(it.html ?? "")), image: s(it.image), gallery: j(it.gallery, []), photographer: s(it.photographer), productPaths: j(it.productPaths, []), rating: n(it.rating), featured: !!it.featured, status: status(it.status), metaTitle: s(it.metaTitle), metaDescription: s(it.metaDescription), weddingDate: d(it.weddingDate) ?? null, publishedAt: d(it.publishedAt) };
        await db.review.upsert({ where: { path: key! }, create: data, update: data });
        break;
      }
      default:
        throw new Error(`Onbekend type “${type}”.`);
    }
    if (exists) res.updated++;
    else res.created++;
  } catch (e) {
    res.skipped++;
    if (res.errors.length < 20) res.errors.push(`${String(it.path ?? it.from ?? it.name ?? "?")}: ${e instanceof Error ? e.message.split("\n").pop() : "fout"}`);
  }
}

async function existing(type: string, key: string | null, it: Item): Promise<{ table: string; id: string } | null> {
  const find = async (table: "page" | "post" | "product" | "category" | "review") => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = (await (db[table] as any).findUnique({ where: { path: key }, select: { id: true } })) as { id: string } | null;
    return r ? { table, id: r.id } : null;
  };
  switch (type) {
    case "posts":
      return find("post");
    case "pages":
      return find("page");
    case "products":
    case "prices":
      return find("product");
    case "categories":
      return find("category");
    case "reviews":
      return find("review");
    case "redirects": {
      const r = await db.redirect.findUnique({ where: { from: key! }, select: { id: true } });
      return r ? { table: "redirect", id: r.id } : null;
    }
    case "brands": {
      const r = await db.brand.findUnique({ where: { kind_slug: { kind: String(it.kind), slug: String(it.slug) } }, select: { id: true } });
      return r ? { table: "brand", id: r.id } : null;
    }
    case "seo":
      for (const t of ["page", "post", "product", "category", "review"] as const) {
        const r = await find(t);
        if (r) return r;
      }
      return null;
  }
  return null;
}
