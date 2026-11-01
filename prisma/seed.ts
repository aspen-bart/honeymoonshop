// Vult de database met de gescrapete content uit content/*.json (zie scripts/scrape.mjs).
// Veilig om opnieuw te draaien: alle content wordt eerst leeggemaakt, gebruikers en instellingen blijven bestaan.
// Gebruik: npm run db:seed
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";
import { polish } from "./polish";

const db = new PrismaClient();
const root = path.resolve(__dirname, "..");
// Afbeeldingen die ook op de oude site ontbreken (404) laten we weg: in HTML én in galerijen.
const exists = (src: string | null | undefined) => !!src && (!src.startsWith("/uploads/") || fs.existsSync(path.join(root, "public", src)));
function fixImages(value: unknown): unknown {
  if (typeof value === "string") return value.replace(/<img [^>]*src="(\/uploads\/[^"]+)"[^>]*\/?>/g, (tag, src) => (exists(src) ? tag : "")).replace(/<figure>\s*<\/figure>/g, "");
  if (Array.isArray(value)) return value.filter((v) => !(v && typeof v === "object" && "src" in v && !exists((v as { src: string }).src)) && !(typeof v === "string" && v.startsWith("/uploads/") && !exists(v))).map(fixImages);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, (k === "src" || k === "image" || k === "ogImage" || k === "brandLogo") && typeof v === "string" && !exists(v) ? null : fixImages(v)]));
  return value;
}
const read = <T>(name: string): T => fixImages(JSON.parse(fs.readFileSync(path.join(root, "content", `${name}.json`), "utf8"))) as T;

// .env inlezen (tsx laadt die niet zelf)
for (const line of fs.readFileSync(path.join(root, ".env"), "utf8").split(/\r?\n/)) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/.exec(line);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
}

type Img = { src: string; alt: string };
type Garment = {
  kind: "dress" | "suit";
  wpId: number | null;
  slug: string;
  path: string;
  name: string;
  brandSlug: string | null;
  brandLogo: string | null;
  articleNumber: string | null;
  descriptionHtml: string;
  priceText: string | null;
  priceMin: number | null;
  priceMax: number | null;
  images: Img[];
  title: string;
  description: string | null;
  ogImage: string | null;
  datePublished: string | null;
  dateModified: string | null;
  lastmod: string | null;
  attributes: Record<string, string[]>;
  collections: string[];
  sale: boolean;
  sortOrder: number;
};
type Accessory = {
  wpId: number | null;
  path: string;
  slug: string;
  name: string;
  descriptionHtml: string;
  longDescriptionHtml: string | null;
  price: number | null;
  sku: string | null;
  brand: string | null;
  images: Img[];
  categoryPath: string | null;
  title: string;
  description: string | null;
  datePublished: string | null;
  dateModified: string | null;
  lastmod: string | null;
};
type Archive = { h1: string; introHtml: string; bottomHtml: string; parentPath: string | null; title: string; description: string | null };
type ScrapedPage = { path: string; h1: string; hero: Img | null; html: string; faqs: { q: string; a: string }[]; title: string; description: string | null; ogImage: string | null; robots: string | null; datePublished: string | null; dateModified: string | null; lastmod: string | null; archive?: Archive };
type ScrapedPost = { path: string; slug: string; h1: string; hero: Img | null; categories: string[]; html: string; title: string; description: string | null; ogImage: string | null; datePublished: string | null; dateModified: string | null; author: string | null; lastmod: string | null };

const date = (...vals: (string | null | undefined)[]) => {
  for (const v of vals) {
    if (!v) continue;
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date("2024-01-01T00:00:00Z");
};
const nlDate = (s: string | null) => {
  const m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s ?? "");
  return m ? new Date(Date.UTC(+m[3], +m[2] - 1, +m[1], 12)) : null;
};
const plain = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
/** Yoast plakt vaak "- Honeymoon shop" achter de titel; die laten we staan (SEO behouden). Lege velden worden null. */
const metaOrNull = (s: string | null | undefined) => (s && s.trim() ? s.trim() : null);

const NOINDEX_PAGES = ["/bedankt-voor-je-sollicitatie/", "/bedankt-voor-jouw-aanmelding/", "/bedank-voor-het-invullen/", "/enquete-bridal-masterclass/"];

function templateFor(p: ScrapedPage): { template: string; data: Record<string, unknown> } {
  switch (p.path) {
    case "/afspraak-maken/":
      return { template: "appointment", data: { type: null } };
    case "/afspraak-maken/trouwjurk-passen/":
      return { template: "appointment", data: { type: "trouwjurk" } };
    case "/afspraak-maken/trouwpak-passen/":
      return { template: "appointment", data: { type: "trouwpak" } };
    case "/afspraak-maken/summersale/":
      return { template: "appointment", data: { type: "trouwjurk", source: "summersale" } };
    case "/contact/":
      return { template: "contact", data: {} };
    case "/real-brides/real-brides-toevoegen/":
      return { template: "review-submit", data: {} };
    case "/aanmelden-nieuwsbrief/":
      return { template: "newsletter", data: {} };
    case "/trouwjurken/":
      return { template: "listing", data: { kind: "dress", bottomHtml: p.archive?.bottomHtml ?? "" } };
    case "/pakken/":
      return { template: "listing", data: { kind: "suit", bottomHtml: p.archive?.bottomHtml ?? "" } };
    case "/blog/":
      return { template: "listing", data: { kind: "blog", bottomHtml: p.archive?.bottomHtml ?? "" } };
    case "/real-brides/":
      return { template: "listing", data: { kind: "reviews", bottomHtml: p.archive?.bottomHtml ?? "" } };
  }
  if (NOINDEX_PAGES.includes(p.path) && p.path !== "/enquete-bridal-masterclass/") return { template: "thanks", data: {} };
  return { template: "default", data: {} };
}

const NEW_PAGES = [
  {
    path: "/cookies/",
    title: "Cookieverklaring",
    metaTitle: "Cookieverklaring: welke cookies wij gebruiken | Honeymoon shop",
    metaDescription: "Lees welke cookies de website van de Honeymoon shop plaatst, waarvoor we ze gebruiken, hoe lang ze bewaard blijven en hoe je je toestemming wijzigt.",
    html: `<blockquote><p><strong>Concepttekst</strong> — deze cookieverklaring is opgesteld bij de vernieuwing van de website en moet nog juridisch gecontroleerd worden.</p></blockquote>
<p>Op deze website gebruiken wij cookies. Een cookie is een klein tekstbestand dat bij je bezoek in je browser wordt opgeslagen. Hieronder lees je welke cookies de website van de Honeymoon shop, Korte Hoogstraat 4, 3011 GL Rotterdam (KvK 24242775) plaatst en waarom.</p>
<h2>Welke cookies plaatsen wij?</h2>
<table><thead><tr><th>Naam</th><th>Partij</th><th>Doel</th><th>Categorie</th><th>Bewaartermijn</th></tr></thead><tbody>
<tr><td>hms_consent</td><td>Honeymoon shop</td><td>Onthoudt je cookievoorkeuren</td><td>Functioneel</td><td>12 maanden</td></tr>
<tr><td>hms_session</td><td>Honeymoon shop</td><td>Houdt medewerkers ingelogd in het beheer (niet voor bezoekers)</td><td>Functioneel</td><td>8 uur</td></tr>
<tr><td>_ga, _ga_*</td><td>Google (via Google Tag Manager)</td><td>Anoniem meten hoe de website gebruikt wordt — alleen na toestemming</td><td>Statistiek</td><td>maximaal 24 maanden</td></tr>
<tr><td>_gcl_au, _fbp</td><td>Google, Meta</td><td>Advertenties meten en personaliseren — alleen na toestemming</td><td>Marketing</td><td>maximaal 90 dagen</td></tr>
</tbody></table>
<p>Je favoriete jurken en pakken bewaren we in de lokale opslag van je eigen browser (geen cookie). Deze gegevens worden niet naar ons verstuurd, tenzij je ze zelf meestuurt met een afspraakverzoek.</p>
<h2>Toestemming geven of wijzigen</h2>
<p>Bij je eerste bezoek vragen we toestemming voor statistiek- en marketingcookies. Functionele cookies zijn nodig om de website te laten werken en plaatsen we altijd. Je kunt je keuze op elk moment wijzigen via de knop <strong>Cookievoorkeuren</strong> onderaan iedere pagina. Je kunt cookies ook verwijderen via de instellingen van je browser.</p>
<h2>Meer informatie</h2>
<p>Hoe wij met je persoonsgegevens omgaan, lees je in onze <a href="/privacy/">privacyverklaring</a>. Vragen? Neem <a href="/contact/">contact met ons op</a>.</p>
<p><em>Laatst gewijzigd: 30 oktober 2026</em></p>`,
  },
  {
    path: "/favorieten/",
    title: "Mijn favorieten",
    template: "favorites",
    noindex: true,
    metaTitle: "Mijn favoriete trouwjurken en trouwpakken | Honeymoon shop",
    metaDescription: "Bekijk de trouwjurken en trouwpakken die je als favoriet hebt bewaard en neem ze in één klik mee naar je pasafspraak bij de Honeymoon shop in Rotterdam.",
    html: "<p>Hier vind je de jurken, pakken en accessoires die je met het hartje hebt bewaard. Ze worden alleen in je eigen browser opgeslagen. Plan je pasafspraak en stuur je favorieten direct mee, dan liggen ze voor je klaar.</p>",
  },
];

async function main() {
  console.log("Rollen en gebruikers…");
  const roles = [
    { key: "admin", name: "Beheerder" },
    { key: "editor", name: "Redacteur" },
    { key: "viewer", name: "Alleen-lezen" },
  ];
  for (const r of roles) await db.role.upsert({ where: { key: r.key }, create: r, update: { name: r.name } });
  const roleId = async (key: string) => (await db.role.findUniqueOrThrow({ where: { key } })).id;
  for (const [envUser, envPass, role, name] of [
    ["ADMIN_EMAIL", "ADMIN_PASSWORD", "admin", "Beheerder"],
    ["EDITOR_EMAIL", "EDITOR_PASSWORD", "editor", "Redactie"],
    ["VIEWER_EMAIL", "VIEWER_PASSWORD", "viewer", "Meelezer"],
  ] as const) {
    const email = process.env[envUser];
    const pass = process.env[envPass];
    if (!email || !pass) continue;
    const exists = await db.user.findUnique({ where: { email } });
    if (!exists) await db.user.create({ data: { email, name, passwordHash: await bcrypt.hash(pass, 11), roleId: await roleId(role) } });
  }

  console.log("Content leegmaken…");
  await db.appointment.updateMany({ data: { productId: null } });
  await db.$transaction([db.product.deleteMany(), db.category.deleteMany(), db.brand.deleteMany(), db.page.deleteMany(), db.post.deleteMany(), db.blogCategory.deleteMany(), db.review.deleteMany(), db.redirect.deleteMany(), db.media.deleteMany()]);

  // ---------- merken ----------
  const filters = read<{ dress: { name: string; terms: { name: string; slug: string }[] }[]; suit: { name: string; terms: { name: string; slug: string }[] }[] }>("filters");
  const dressBrands = filters.dress.find((g) => g.name === "Merk")?.terms ?? [];
  const suitBrands = filters.suit.find((g) => g.name === "Merken")?.terms ?? [];
  const dresses = read<Garment[]>("dresses");
  const suits = read<Garment[]>("suits");
  const brandIds = new Map<string, string>();
  for (const t of dressBrands) {
    const logo = dresses.find((d) => d.brandSlug === t.slug && d.brandLogo)?.brandLogo ?? null;
    const b = await db.brand.create({ data: { kind: "dress", slug: t.slug, name: t.name, logo } });
    brandIds.set(`dress:${t.name}`, b.id);
    brandIds.set(`dress-slug:${t.slug}`, b.id);
  }
  for (const t of suitBrands) {
    const b = await db.brand.create({ data: { kind: "suit", slug: t.slug, name: t.name } });
    brandIds.set(`suit:${t.name}`, b.id);
  }

  // ---------- collecties ----------
  console.log("Collecties en categorieën…");
  const collections = read<(Archive & { path: string; kind: "dress" | "suit"; items: string[]; lastmod: string | null })[]>("collections");
  const catIds = new Map<string, string>();
  for (const [i, c] of collections.entries()) {
    const cat = await db.category.create({
      data: { kind: c.kind, path: c.path, name: c.h1 || c.title, introHtml: c.introHtml, bottomHtml: c.bottomHtml, sortOrder: i, metaTitle: metaOrNull(c.title), metaDescription: metaOrNull(c.description), updatedAt: date(c.lastmod) },
    });
    catIds.set(c.path, cat.id);
  }

  // ---------- jurken en pakken ----------
  console.log(`Jurken (${dresses.length}) en pakken (${suits.length})…`);
  for (const g of [...dresses, ...suits]) {
    const brandName = g.kind === "dress" ? g.attributes["Merk"]?.[0] : g.attributes["Merken"]?.[0];
    const brandId = (brandName && brandIds.get(`${g.kind}:${brandName}`)) || (g.brandSlug && brandIds.get(`dress-slug:${g.brandSlug}`)) || null;
    await db.product.create({
      data: {
        kind: g.kind,
        path: g.path,
        slug: g.slug,
        name: g.name,
        brandId,
        articleNumber: g.articleNumber,
        descriptionHtml: g.descriptionHtml,
        priceText: g.priceText,
        priceMin: g.priceMin,
        priceMax: g.priceMax,
        images: JSON.stringify(g.images),
        attributes: JSON.stringify(g.attributes),
        sale: g.sale || g.collections.includes("/trouwjurken/big-sale/"),
        featured: false,
        sortOrder: g.sortOrder,
        metaTitle: metaOrNull(g.title),
        metaDescription: metaOrNull(g.description),
        ogImage: g.images[0]?.src ?? null,
        wpId: g.wpId,
        publishedAt: date(g.datePublished, g.lastmod),
        updatedAt: date(g.dateModified, g.lastmod),
        categories: { connect: g.collections.filter((c) => catIds.has(c)).map((c) => ({ id: catIds.get(c)! })) },
      },
    });
  }
  // Uitgelicht: de jurken uit de "Highlights"-slider van de oude homepage + nieuwste binnenkomers
  const home = read<{ html: string }>("home");
  const highlightPaths = [...home.html.matchAll(/href="(\/trouwjurken\/[^"]+\/)"/g)].map((m) => m[1]);
  await db.product.updateMany({ where: { path: { in: highlightPaths } }, data: { featured: true } });
  const newArrivals = collections.find((c) => c.path === "/trouwjurken/new-arrivals/")?.items.slice(0, 8) ?? [];
  await db.product.updateMany({ where: { path: { in: newArrivals } }, data: { featured: true } });
  const nieuwePakken = collections.find((c) => c.path === "/pakken/nieuwe-collectie/")?.items.slice(0, 8) ?? suits.slice(0, 8).map((s) => s.path);
  await db.product.updateMany({ where: { path: { in: nieuwePakken } }, data: { featured: true } });

  // ---------- accessoires ----------
  const productCats = read<(Archive & { path: string; products: string[]; lastmod: string | null })[]>("product-categories");
  for (const [i, c] of productCats.entries()) {
    const cat = await db.category.create({
      data: { kind: "accessory", path: c.path, name: c.h1 || c.title, introHtml: c.introHtml, bottomHtml: c.bottomHtml, sortOrder: i, metaTitle: metaOrNull(c.title), metaDescription: metaOrNull(c.description), updatedAt: date(c.lastmod) },
    });
    catIds.set(c.path, cat.id);
  }
  for (const c of productCats) {
    if (c.parentPath && catIds.has(c.parentPath) && c.parentPath !== c.path) await db.category.update({ where: { id: catIds.get(c.path)! }, data: { parentId: catIds.get(c.parentPath)! } });
  }
  const accessories = read<Accessory[]>("products");
  console.log(`Accessoires (${accessories.length})…`);
  const accBrands = new Map<string, string>();
  for (const [i, p] of accessories.entries()) {
    const inCats = productCats.filter((c) => c.products.includes(p.path)).map((c) => c.path);
    if (p.categoryPath && catIds.has(p.categoryPath) && !inCats.includes(p.categoryPath)) inCats.push(p.categoryPath);
    let brandId: string | null = null;
    const brandName = p.brand || /\b(Poirier|Emmerling|Linea Sposa|Bianco Evento|Mascullini)\b/i.exec(p.name)?.[1] || null;
    if (brandName) {
      const slug = brandName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      if (!accBrands.has(slug)) accBrands.set(slug, (await db.brand.create({ data: { kind: "accessory", slug, name: brandName } })).id);
      brandId = accBrands.get(slug)!;
    }
    await db.product.create({
      data: {
        kind: "accessory",
        path: p.path,
        slug: p.slug,
        name: p.name,
        brandId,
        sku: p.sku != null ? String(p.sku) : null,
        descriptionHtml: [p.descriptionHtml, p.longDescriptionHtml].filter(Boolean).join("\n"),
        price: p.price,
        images: JSON.stringify(p.images),
        sortOrder: i,
        metaTitle: metaOrNull(p.title),
        metaDescription: metaOrNull(p.description),
        ogImage: p.images[0]?.src ?? null,
        wpId: p.wpId,
        publishedAt: date(p.datePublished, p.lastmod),
        updatedAt: date(p.dateModified, p.lastmod),
        categories: { connect: inCats.map((c) => ({ id: catIds.get(c)! })) },
      },
    });
  }

  // ---------- pagina's ----------
  const pages = read<ScrapedPage[]>("pages");
  console.log(`Pagina's (${pages.length})…`);
  for (const p of pages) {
    const { template, data } = templateFor(p);
    const isListing = template === "listing";
    await db.page.create({
      data: {
        path: p.path,
        title: (isListing ? p.archive?.h1 : null) || p.h1 || p.title.split(/ [-|–] /)[0],
        heroImage: p.hero?.src ?? null,
        heroAlt: p.hero?.alt ?? "",
        html: isListing ? (p.archive?.introHtml ?? "") : p.html,
        faqs: JSON.stringify(p.faqs),
        template,
        templateData: JSON.stringify(data),
        noindex: NOINDEX_PAGES.includes(p.path) || /noindex/.test(p.robots ?? ""),
        metaTitle: metaOrNull(p.title),
        metaDescription: metaOrNull(p.description),
        ogImage: p.ogImage ?? p.hero?.src ?? null,
        publishedAt: date(p.datePublished, p.lastmod),
        updatedAt: date(p.dateModified, p.lastmod),
      },
    });
  }
  // Homepage als beheerbare pagina (meta, intro en FAQ's van de huidige homepage)
  const homeData = read<{ html: string; title: string; description: string | null }>("home");
  const decode = (t: string) => t.replace(/&amp;/g, "&").replace(/&#0?39;/g, "'").replace(/&quot;/g, '"');
  const homeFaqs = [...homeData.html.matchAll(/<summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g)].map((m) => ({ q: decode(m[1].trim()), a: decode(plain(m[2])) }));
  const homeIntro = /Creating <em>happiness<\/em>[\s\S]*?(<p>[\s\S]*?<\/p>)/.exec(homeData.html)?.[1] ?? "";
  await db.page.create({
    data: { path: "/", title: "Creating happiness for the bride & groom", html: homeIntro, faqs: JSON.stringify(homeFaqs), template: "home", metaTitle: homeData.title, metaDescription: homeData.description, publishedAt: new Date("2023-06-01T00:00:00Z"), updatedAt: new Date("2026-10-01T00:00:00Z") },
  });
  for (const p of NEW_PAGES) {
    await db.page.create({
      data: { path: p.path, title: p.title, html: p.html, template: p.template ?? "default", noindex: p.noindex ?? false, metaTitle: p.metaTitle, metaDescription: p.metaDescription, publishedAt: new Date("2026-10-30T09:00:00Z"), updatedAt: new Date("2026-10-30T09:00:00Z") },
    });
  }

  // ---------- blog ----------
  const blogCats = read<{ path: string; slug: string; name: string; introHtml: string; title: string; description: string | null }[]>("blog-categories");
  const blogCatIds = new Map<string, string>();
  for (const c of blogCats) {
    const bc = await db.blogCategory.create({ data: { slug: c.slug, name: c.name, introHtml: c.introHtml, metaTitle: metaOrNull(c.title), metaDescription: metaOrNull(c.description) } });
    blogCatIds.set(c.path, bc.id);
  }
  const posts = read<ScrapedPost[]>("posts");
  console.log(`Blogs (${posts.length})…`);
  for (const p of posts) {
    const firstP = /<p>([\s\S]*?)<\/p>/.exec(p.html)?.[1] ?? "";
    await db.post.create({
      data: {
        path: p.path,
        slug: p.slug,
        title: p.h1 || p.title,
        excerpt: plain(firstP).slice(0, 220),
        html: p.html,
        heroImage: p.hero?.src ?? p.ogImage,
        heroAlt: p.hero?.alt || p.h1,
        categoryId: p.categories.map((c) => blogCatIds.get(c)).find(Boolean) ?? null,
        authorName: p.author && !/admin/i.test(p.author) ? p.author : "Team Honeymoon shop",
        metaTitle: metaOrNull(p.title),
        metaDescription: metaOrNull(p.description),
        ogImage: p.ogImage ?? p.hero?.src ?? null,
        publishedAt: date(p.datePublished, p.lastmod),
        updatedAt: date(p.dateModified, p.lastmod),
      },
    });
  }

  // ---------- reviews (real brides) ----------
  const rbs = read<{ path: string; slug: string; name: string; date: string | null; photographer: string | null; image: string | null; gallery: string[]; html: string; products: string[]; title: string; description: string | null; datePublished: string | null; dateModified: string | null; lastmod: string | null }[]>("real-brides");
  console.log(`Reviews (${rbs.length})…`);
  for (const [i, r] of rbs.entries()) {
    const published = nlDate(r.date) ?? date(r.datePublished, r.lastmod);
    await db.review.create({
      data: {
        path: r.path,
        slug: r.slug,
        name: r.name || r.title.split(/ [-|–] /)[0],
        html: r.html,
        image: r.image,
        gallery: JSON.stringify(r.gallery.filter((g) => g !== r.image)),
        photographer: r.photographer,
        productPaths: JSON.stringify(r.products),
        featured: i < 12 && plain(r.html).length > 120,
        metaTitle: metaOrNull(r.title),
        metaDescription: metaOrNull(r.description),
        publishedAt: published,
        updatedAt: date(r.dateModified, r.lastmod),
      },
    });
  }

  // ---------- redirects ----------
  for (const r of read<{ from: string; to: string }[]>("redirects")) await db.redirect.create({ data: { from: r.from, to: r.to } });

  // ---------- media ----------
  const uploads = path.join(root, "public", "uploads");
  const files = fs.existsSync(uploads) ? fs.readdirSync(uploads).filter((f) => f.endsWith(".webp")) : [];
  console.log(`Media (${files.length})…`);
  const altFor = new Map<string, string>();
  for (const g of [...dresses, ...suits, ...accessories]) for (const im of g.images) if (im.alt) altFor.set(im.src, im.alt);
  const rows = [];
  for (const f of files) {
    const full = path.join(uploads, f);
    let meta: sharp.Metadata | null = null;
    try {
      meta = await sharp(full).metadata();
    } catch {}
    rows.push({ path: `/uploads/${f}`, alt: altFor.get(`/uploads/${f}`) ?? "", width: meta?.width ?? null, height: meta?.height ?? null, size: fs.statSync(full).size });
  }
  for (let i = 0; i < rows.length; i += 500) await db.media.createMany({ data: rows.slice(i, i + 500) });

  console.log("Opschonen (redirects, losse accessoires, dubbele meta's)…");
  await polish(db);

  const counts = await Promise.all([db.product.count(), db.category.count(), db.page.count(), db.post.count(), db.review.count(), db.media.count()]);
  console.log(`Klaar: ${counts[0]} producten, ${counts[1]} categorieën, ${counts[2]} pagina's, ${counts[3]} blogs, ${counts[4]} reviews, ${counts[5]} media.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
