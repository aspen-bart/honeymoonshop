// SEO-controle op de productie-build. Start `next start` op een vrije poort, haalt alle URL's uit de sitemaps
// op en volgt alle interne links. Faalt (exit 1) bij fouten; waarschuwingen staan in seo-report.json.
// Gebruik: npm run seo:check   (draait ook automatisch na `npm run build`)
// Optioneel: SEO_BASE=http://localhost:3300 om een al draaiende server te controleren.
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const line of fs.existsSync(path.join(root, ".env")) ? fs.readFileSync(path.join(root, ".env"), "utf8").split(/\r?\n/) : []) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/.exec(line);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
}
const SITE = (process.env.SITE_URL || "https://www.honeymoonshop.nl").replace(/\/$/, "");
const PORT = 3399;
let BASE = process.env.SEO_BASE;
const PLACEHOLDERS = [/voorbeeldsite/i, /voorbeeldbedrijf/i, /voorbeeldstraat/i, /lorem ipsum/i, /GTM-XXXXXXX(?![\w-])/];

const errors = [];
const warnings = [];
const err = (url, msg) => errors.push(`${url}  ${msg}`);
const warn = (url, msg) => warnings.push(`${url}  ${msg}`);

async function startServer() {
  if (BASE) return null;
  // Nooit per ongeluk een oude server controleren: de poort moet vrij zijn.
  try {
    await fetch(`http://localhost:${PORT}/robots.txt`);
    throw new Error(`Poort ${PORT} is al in gebruik; stop die server eerst.`);
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("Poort")) throw e;
  }
  const distDir = process.env.NEXT_DIST_DIR || ".next";
  const child = spawn("npx", ["next", "start", "-p", String(PORT)], { cwd: root, shell: true, env: { ...process.env, NEXT_DIST_DIR: distDir, NODE_ENV: "production" }, stdio: ["ignore", "pipe", "pipe"] });
  BASE = `http://localhost:${PORT}`;
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch(`${BASE}/robots.txt`);
      if (r.ok) return child;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  child.kill();
  throw new Error("Productieserver start niet");
}

async function get(p, opts = {}) {
  const res = await fetch(BASE + p, { redirect: "manual", ...opts });
  return { status: res.status, location: res.headers.get("location"), type: res.headers.get("content-type") ?? "", text: res.status === 200 ? await res.text() : "" };
}

async function pool(items, n, fn) {
  const queue = [...items];
  await Promise.all(Array.from({ length: n }, async () => {
    while (queue.length) await fn(queue.shift());
  }));
}

const toPath = (loc) => loc.replace(SITE, "");

async function main() {
  const server = await startServer();
  try {
    // robots.txt
    const robots = await get("/robots.txt");
    if (robots.status !== 200) err("/robots.txt", `status ${robots.status}`);
    if (!/Sitemap: https:\/\/www\.[^\s]+\/sitemap_index\.xml/.test(robots.text)) err("/robots.txt", "geen Sitemap-regel naar het productiedomein");
    if (/User-agent: \*\s+Disallow: \/\s*$/m.test(robots.text)) err("/robots.txt", "Disallow: / voor alle crawlers");

    // sitemaps
    const index = await get("/sitemap_index.xml");
    if (index.status !== 200) err("/sitemap_index.xml", `status ${index.status}`);
    const sitemapUrls = [...index.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => toPath(m[1]));
    const inSitemap = new Map();
    for (const sm of sitemapUrls) {
      const r = await get(sm);
      if (r.status !== 200) {
        err(sm, `status ${r.status}`);
        continue;
      }
      for (const m of r.text.matchAll(/<url><loc>([^<]+)<\/loc><lastmod>([^<]+)<\/lastmod>/g)) inSitemap.set(toPath(m[1]), { sitemap: sm, loc: m[1] });
    }
    console.log(`${inSitemap.size} URL's in ${sitemapUrls.length} sitemaps`);

    // pagina's crawlen: sitemap + gevonden interne links
    const pages = new Map(); // pad → resultaat
    const linkedFrom = new Map();
    const titles = new Map();
    const descriptions = new Map();
    const queue = [...new Set([...inSitemap.keys(), "/"])];
    const seen = new Set(queue);

    async function check(p) {
      const r = await get(p);
      pages.set(p, r.status);
      if (r.status !== 200) {
        if (inSitemap.has(p)) err(p, `staat in de sitemap maar geeft status ${r.status}${r.location ? ` → ${r.location}` : ""}`);
        return;
      }
      if (!r.type.includes("text/html")) return;
      const $ = cheerio.load(r.text);
      const robotsMeta = $('meta[name="robots"]').attr("content") ?? "";
      const noindex = /noindex/.test(robotsMeta);
      if ($('meta[name="robots"]').length !== 1) err(p, `${$('meta[name="robots"]').length}× meta robots`);
      if (inSitemap.has(p) && noindex) err(p, "noindex-pagina staat in de sitemap");

      const h1 = $("h1").length;
      if (h1 !== 1) err(p, `${h1} H1's`);
      if ($("main").length !== 1) err(p, `${$("main").length} <main>-elementen`);

      const title = $("title").text().trim();
      const desc = $('meta[name="description"]').attr("content")?.trim() ?? "";
      if (!title) err(p, "geen title");
      if (!desc) err(p, "geen meta description");
      if (!noindex) {
        if (title.length < 30 || title.length > 70) warn(p, `title ${title.length} tekens: ${title}`);
        if (desc.length < 120 || desc.length > 165) warn(p, `description ${desc.length} tekens`);
        if (titles.has(title)) err(p, `dubbele title (ook op ${titles.get(title)})`);
        else titles.set(title, p);
        if (descriptions.has(desc)) err(p, `dubbele description (ook op ${descriptions.get(desc)})`);
        else descriptions.set(desc, p);
        const canon = $('link[rel="canonical"]');
        if (canon.length !== 1) err(p, `${canon.length} canonicals`);
        else if (canon.attr("href") !== `${SITE}${p.split("?")[0]}`) err(p, `canonical ${canon.attr("href")} ≠ ${SITE}${p}`);
      }
      for (const prop of ["og:title", "og:description", "og:url", "og:image", "og:type", "og:locale"]) {
        const n = $(`meta[property="${prop}"]`).length;
        if (n !== 1) err(p, `${n}× ${prop}`);
      }
      if ($('meta[name="twitter:card"]').attr("content") !== "summary_large_image") err(p, "twitter:card ontbreekt of is niet summary_large_image");

      // structured data
      const types = new Set();
      $('script[type="application/ld+json"]').each((_, el) => {
        try {
          const j = JSON.parse($(el).html());
          for (const n of j["@graph"] ?? [j]) for (const t of [].concat(n["@type"])) types.add(t);
        } catch {
          err(p, "ongeldige JSON-LD");
        }
      });
      if (!types.has("Organization") || !types.has("WebSite")) err(p, "Organization/WebSite ontbreekt in JSON-LD");
      if (p !== "/" && !types.has("BreadcrumbList")) err(p, "BreadcrumbList ontbreekt");
      if (p.startsWith("/trouwjurken/") && !types.has("Product") && !types.has("ItemList") && !noindex && !$("main form").length && !types.has("BreadcrumbList")) warn(p, "geen Product/ItemList");

      // links
      $("a[href]").each((_, a) => {
        const href = $(a).attr("href");
        if (/^(mailto:|tel:|#|javascript:)/.test(href)) return;
        if (/^https?:\/\//.test(href)) {
          let host;
          try {
            host = new URL(href).hostname;
          } catch {
            return err(p, `ongeldige link: ${href}`);
          }
          if (/(^|\.)honeymoonshop\.nl$/.test(host)) return err(p, `absolute interne link ${href}`);
          if ($(a).attr("target") !== "_blank" || !/noopener/.test($(a).attr("rel") ?? "") || !/noreferrer/.test($(a).attr("rel") ?? "")) err(p, `externe link zonder target/rel: ${href}`);
          return;
        }
        if (!href.startsWith("/")) return;
        const clean = href.split(/[?#]/)[0];
        if (!clean.endsWith("/") && !/\.[a-z0-9]{2,5}$/i.test(clean)) err(p, `interne link zonder slash: ${href}`);
        if (/\.[a-z0-9]{2,5}$/i.test(clean) || clean.startsWith("/admin/") || clean.startsWith("/api/")) return;
        if (!linkedFrom.has(clean)) linkedFrom.set(clean, new Set());
        linkedFrom.get(clean).add(p);
        if (!seen.has(clean)) {
          seen.add(clean);
          queue.push(clean);
        }
      });

      // afbeeldingen
      $("main img").each((_, img) => {
        if ($(img).attr("alt") === undefined) err(p, `afbeelding zonder alt: ${$(img).attr("src")}`);
      });
      // placeholders
      for (const re of PLACEHOLDERS) if (re.test(r.text)) err(p, `voorbeeldwaarde gevonden: ${re}`);
      // dunne content
      if (!noindex && inSitemap.has(p)) {
        const words = $("main").text().replace(/\s+/g, " ").trim().split(" ").length;
        if (words < 300) warn(p, `dunne content (${words} woorden in <main>)`);
      }
    }

    while (queue.length) {
      const batch = queue.splice(0, queue.length);
      await pool(batch, 8, check);
      process.stdout.write(`\r${pages.size} pagina's gecontroleerd…`);
    }
    console.log();

    // interne links naar niet-200 (404 of redirect)
    for (const [target, from] of linkedFrom) {
      const status = pages.get(target);
      if (status !== 200) err([...from][0], `interne link naar ${target} geeft status ${status} (${from.size} pagina's)`);
    }
    // weespagina's
    for (const p of inSitemap.keys()) {
      const n = linkedFrom.get(p)?.size ?? 0;
      if (p !== "/" && n === 0) err(p, "weespagina: geen enkele interne link");
      else if (p !== "/" && n < 3) warn(p, `slechts ${n} interne link(s)`);
    }

    // redirects, 404, trailing slash
    const slash = await get("/contact");
    if (slash.status !== 301 || !/\/contact\/$/.test(slash.location ?? "")) err("/contact", `verwacht 301 naar /contact/, kreeg ${slash.status} ${slash.location}`);
    const nf = await get("/deze-pagina-bestaat-echt-niet/");
    if (nf.status !== 404) err("/deze-pagina-bestaat-echt-niet/", `404-pagina geeft status ${nf.status}`);
    const old = await get("/vacature/");
    if (old.status !== 301) err("/vacature/", `oude redirect geeft ${old.status}`);
  } finally {
    if (server) {
      if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { shell: true });
      else server.kill();
    }
  }

  fs.writeFileSync(path.join(root, "seo-report.json"), JSON.stringify({ checkedAt: new Date().toISOString(), errors, warnings }, null, 2));
  console.log(`\nFouten: ${errors.length} · Waarschuwingen: ${warnings.length} (zie seo-report.json)`);
  for (const e of errors.slice(0, 40)) console.log(`  ✗ ${e}`);
  if (errors.length > 40) console.log(`  … en nog ${errors.length - 40}`);
  process.exit(errors.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
