// Haalt alle content van www.honeymoonshop.nl op en schrijft die naar content/*.json.
// - HTML wordt gecachet in scripts/raw/ zodat een herhaalde run niets opnieuw ophaalt (verwijder de map voor verse data).
// - Afbeeldingen worden niet hier gedownload: alle gebruikte URL's komen in content/images.json en
//   scripts/download-images.mjs haalt ze op, verkleint ze en zet ze als WebP in public/uploads/.
// Gebruik: npm run scrape
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";
import sanitizeHtml from "sanitize-html";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAW = path.join(root, "scripts", "raw");
const OUT = path.join(root, "content");
fs.mkdirSync(RAW, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

const BASE = "https://www.honeymoonshop.nl";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";

// Pagina's die we bewust niet overnemen (login, account, wachtwoord, favorieten-lijst van WooCommerce)
const SKIP_PAGES = ["/account/", "/login/", "/mijn-honeymoon-shop/wachtwoord-vergeten/", "/favorieten/"];

// ---------- fetch met cache en beperkte gelijktijdigheid ----------
let active = 0;
const queue = [];
function limit(fn) {
  return new Promise((resolve, reject) => {
    const run = async () => {
      active++;
      try {
        resolve(await fn());
      } catch (e) {
        reject(e);
      } finally {
        active--;
        queue.shift()?.();
      }
    };
    if (active < 2) run();
    else queue.push(run);
  });
}

function cacheFile(url) {
  const p = url.replace(BASE, "").replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "home";
  return path.join(RAW, `${p.slice(0, 180)}.html`);
}

async function get(url) {
  const file = cacheFile(url);
  if (fs.existsSync(file)) {
    const cached = fs.readFileSync(file, "utf8");
    return cached === "__404__" ? null : cached;
  }
  return limit(async () => {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "nl-NL" }, redirect: "follow" });
        if (res.status === 404 || res.status === 410) {
          fs.writeFileSync(file, "__404__");
          return null;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        // Een redirect naar een andere URL (bv. __trashed → home) behandelen we als "bestaat niet".
        if (new URL(res.url).pathname !== new URL(url).pathname) {
          fs.writeFileSync(file, "__404__");
          return null;
        }
        const html = await res.text();
        fs.writeFileSync(file, html);
        return html;
      } catch (e) {
        if (attempt === 3) {
          console.warn(`  ! ${url}: ${e.message}`);
          return null;
        }
        await new Promise((r) => setTimeout(r, 15000 * attempt));
      }
    }
  });
}

async function sitemap(name) {
  const xml = await get(`${BASE}/${name}.xml`);
  const $ = cheerio.load(xml ?? "", { xml: true });
  return $("url")
    .map((_, el) => ({ loc: $(el).find("loc").first().text().trim(), lastmod: $(el).find("lastmod").first().text().trim() || null }))
    .get();
}

// ---------- hulpfuncties ----------
const images = new Map(); // lokaal pad → externe URL

/** Externe afbeeldings-URL → lokaal pad /uploads/<naam>.webp (en registreren voor download). */
function img(url) {
  if (!url) return null;
  url = url.trim();
  if (url.startsWith("//")) url = `https:${url}`;
  if (url.startsWith("/")) url = BASE + url;
  if (!/^https?:\/\/(www\.)?honeymoonshop\.nl\/wp-content\/uploads\//.test(url)) return null;
  url = url.split("?")[0];
  const base = decodeURIComponent(url.split("/").pop()).replace(/\.(jpe?g|png|webp|gif|avif)$/i, "");
  if (!base || /\.(svg|mp4)$/i.test(url)) return null;
  const local = `/uploads/${base.toLowerCase().replace(/[^a-z0-9._-]+/g, "-")}.webp`;
  if (!images.has(local)) images.set(local, url);
  return local;
}

/** Kies uit src/srcset de grootste variant tot ~1600px breed. */
function bestSrc($el) {
  const src = $el.attr("data-src") || $el.attr("data-lazy-src") || $el.attr("src") || "";
  const srcset = $el.attr("data-srcset") || $el.attr("srcset") || "";
  const cands = srcset
    .split(",")
    .map((s) => s.trim().split(/\s+/))
    .filter((p) => p[0] && /w$/.test(p[1] ?? ""))
    .map((p) => ({ url: p[0], w: parseInt(p[1]) }))
    .filter((c) => c.w <= 1600)
    .sort((a, b) => b.w - a.w);
  if (cands[0]) return cands[0].url;
  return src.startsWith("data:") ? "" : src;
}

function pathOf(url) {
  try {
    const u = new URL(url, BASE);
    let p = u.pathname;
    if (!p.endsWith("/") && !/\.[a-z0-9]+$/i.test(p)) p += "/";
    return p;
  } catch {
    return url;
  }
}

function text(s) {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

function meta($) {
  const graph = (() => {
    try {
      const raw = $('script.yoast-schema-graph, script[type="application/ld+json"]').first().html();
      return JSON.parse(raw)["@graph"] ?? [];
    } catch {
      return [];
    }
  })();
  const page = graph.find((n) => n["@type"] === "WebPage" || (Array.isArray(n["@type"]) && n["@type"].includes("WebPage"))) ?? {};
  const article = graph.find((n) => n["@type"] === "Article" || n["@type"] === "BlogPosting") ?? {};
  const person = graph.find((n) => n["@type"] === "Person");
  return {
    title: text($("title").first().text()),
    description: $('meta[name="description"]').attr("content")?.trim() ?? null,
    ogImage: img($('meta[property="og:image"]').attr("content")),
    robots: $('meta[name="robots"]').attr("content") ?? null,
    datePublished: article.datePublished ?? page.datePublished ?? $('meta[property="article:published_time"]').attr("content") ?? null,
    dateModified: article.dateModified ?? page.dateModified ?? $('meta[property="article:modified_time"]').attr("content") ?? null,
    author: person?.name ?? null,
  };
}

/** Interne link → relatief pad met slash; externe links blijven absoluut. */
function link(href) {
  if (!href) return href;
  if (/^(mailto|tel|whatsapp):/.test(href) || href.startsWith("#")) return href;
  try {
    const u = new URL(href, BASE);
    if (/(^|\.)honeymoonshop\.nl$/.test(u.hostname)) {
      if (u.pathname.startsWith("/wp-content/uploads/")) return img(u.href) ?? u.href;
      return pathOf(u.href) + (u.hash || "");
    }
    return u.href;
  } catch {
    return href;
  }
}

/**
 * Elementor-HTML → schone, semantische HTML (alleen inhoud). Zet achtergrondafbeeldingen om naar <img>,
 * accordeons naar <details>, en vlakt alle wrapper-divs af.
 */
function cleanHtml($, $root) {
  const $c = $root.clone();
  $c.find("script,style,noscript,svg,form,iframe:not([src*='youtube']):not([src*='vimeo']),.breadcrumbs,.elementor-post-info,.swiper-button-prev,.swiper-button-next,.swiper-pagination,.elementor-swiper-button,.product__share,.nextbut,.elementor-widget-share-buttons,.gform_wrapper,.wpcf7,.elementor-widget-form,.elementor-widget-shortcode,.elementor-widget-theme-post-title,.elementor-widget-post-navigation,.elementor-widget-posts,.elementor-widget-loop-grid,.elementor-widget-loop-carousel,.elementor-widget-testimonial-carousel,.elementor-widget-reviews,.ti-widget,.trustindex,.elementor-widget-template").remove();
  // achtergrondafbeeldingen (CTA's, secties) als losse <img>
  $c.find("[style*='background-image']").each((_, el) => {
    const m = /background-image:\s*url\((['"]?)([^'")]+)\1\)/.exec($(el).attr("style") ?? "");
    if (m) $(el).prepend(`<img src="${m[2]}" alt="${($(el).attr("aria-label") ?? "").replace(/"/g, "")}">`);
  });
  // oude elementor-accordeon/toggle → details/summary
  $c.find(".elementor-accordion-item, .elementor-toggle-item").each((_, el) => {
    const q = text($(el).find(".elementor-tab-title").first().text());
    const a = $(el).find(".elementor-tab-content").first().html() ?? "";
    $(el).replaceWith(`<details><summary>${q}</summary>${a}</details>`);
  });
  $c.find("summary").each((_, el) => {
    $(el).text(text($(el).text()));
  });
  // lazy-load en srcset: beste variant als src
  $c.find("img").each((_, el) => {
    const best = bestSrc($(el));
    $(el).attr("src", best);
  });
  // H1 in de body wordt H2 (de pagina heeft één eigen H1)
  $c.find("h1").each((_, el) => {
    el.tagName = "h2";
  });

  let html = sanitizeHtml($.html($c), {
    allowedTags: ["h2", "h3", "h4", "h5", "h6", "p", "ul", "ol", "li", "a", "strong", "em", "b", "i", "br", "img", "blockquote", "table", "thead", "tbody", "tr", "th", "td", "figure", "figcaption", "iframe", "hr", "details", "summary", "u", "sup", "sub"],
    allowedAttributes: { a: ["href", "title"], img: ["src", "alt", "width", "height"], iframe: ["src", "title", "allow", "allowfullscreen"], td: ["colspan", "rowspan"], th: ["colspan", "rowspan"] },
    allowedIframeHostnames: ["www.youtube.com", "youtube.com", "player.vimeo.com", "www.youtube-nocookie.com"],
    transformTags: {
      b: "strong",
      i: "em",
      a: (tagName, attribs) => ({ tagName, attribs: { ...attribs, href: link(attribs.href) } }),
      img: (tagName, attribs) => {
        const local = img(attribs.src);
        return local ? { tagName, attribs: { src: local, alt: attribs.alt ?? "" } } : { tagName: "span", attribs: {} };
      },
    },
    exclusiveFilter: (frame) => frame.tag === "a" && !frame.text.trim() && !frame.mediaChildren?.length && !/<img/.test(frame.text),
  });
  html = html
    .replace(/<span>\s*<\/span>/g, "")
    .replace(/<(p|h[2-6]|li|strong|em)>\s*(&nbsp;|\s)*<\/\1>/g, "")
    .replace(/(\s*<br \/>\s*){2,}/g, "<br />")
    .replace(/\n\s*\n/g, "\n")
    .trim();
  return html;
}

function words(html) {
  return text(cheerio.load(html ?? "").text()).split(" ").filter(Boolean).length;
}

// ---------- detailpagina's ----------
function breadcrumbs($) {
  return $(".breadcrumbs .item")
    .map((_, el) => {
      const a = $(el).find("a");
      return { name: text($(el).text()), path: a.length ? link(a.attr("href")) : null };
    })
    .get();
}

function gallery($) {
  const out = [];
  $(".product__gallery .swiper-slide").each((_, el) => {
    const a = $(el).find("a").first();
    const im = $(el).find("img").first();
    // data-src (768 of 770x1024) is groter dan de getoonde 570x750; srcset kan nog groter (1140x1500)
    const fromSet = bestSrc(im);
    const url = /1140x1500/.test(fromSet) ? fromSet : a.attr("data-src") || fromSet;
    const local = img(url);
    if (local && !out.some((o) => o.src === local)) out.push({ src: local, alt: im.attr("alt")?.trim() ?? "" });
  });
  return out;
}

function priceRange(s) {
  const nums = (s ?? "").replace(/\./g, "").match(/\d+/g)?.map(Number) ?? [];
  return { priceMin: nums[0] ?? null, priceMax: nums[1] ?? nums[0] ?? null };
}

function parseGarment($, url, kind) {
  const d = $(".product__details");
  if (!d.length) return null;
  const brandA = d.find(".title a").first();
  const ld = (() => {
    let out = null;
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const j = JSON.parse($(el).html());
        if (j["@type"] === "Product") out = j;
      } catch {}
    });
    return out;
  })();
  const priceText = text(d.find(".price span").first().text()) || null;
  const descHtml = d
    .children("p")
    .map((_, p) => `<p>${$(p).html()}</p>`)
    .get()
    .join("");
  return {
    kind,
    wpId: Number(d.find("[product-id]").first().attr("product-id")) || ld?.productID || null,
    slug: pathOf(url).split("/").filter(Boolean).pop(),
    path: pathOf(url),
    name: text(d.find("h1").first().text()),
    brandSlug: brandA.length ? pathOf(brandA.attr("href")).split("/").filter(Boolean).pop() : null,
    brandLogo: brandA.length ? img(bestSrc(brandA.find("img"))) : null,
    articleNumber: text(d.find("small").first().text()).replace(/^Artikel nr\.?\s*/i, "") || null,
    descriptionHtml: cleanHtml($, cheerio.load(descHtml)("body")),
    priceText,
    ...priceRange(priceText),
    offerPrice: ld?.offers?.price ? Number(ld.offers.price) : null,
    images: gallery($),
    ...meta($),
  };
}

function parseProduct($, url) {
  const d = $(".product__details");
  if (!d.length) return null;
  let ld = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const j = JSON.parse($(el).html());
      const node = j["@type"] === "Product" ? j : (j["@graph"] ?? []).find((n) => n["@type"] === "Product");
      if (node) ld = node;
    } catch {}
  });
  const offers = Array.isArray(ld?.offers) ? ld.offers[0] : ld?.offers;
  const price = offers?.price ?? offers?.lowPrice ?? offers?.priceSpecification?.[0]?.price ?? offers?.priceSpecification?.price;
  const priceText = text(d.find(".price").first().text()) || null;
  const descHtml = d
    .children("p, .woocommerce-product-details__short-description, ul:not(.custom_usp ul)")
    .map((_, p) => $.html(p))
    .get()
    .join("");
  const crumbs = breadcrumbs($);
  return {
    wpId: Number(d.find("[product-id]").first().attr("product-id")) || Number($('[product-id]').first().attr("product-id")) || null,
    path: pathOf(url),
    slug: pathOf(url).split("/").filter(Boolean).pop(),
    name: text(d.find("h1").first().text()),
    descriptionHtml: cleanHtml($, cheerio.load(descHtml)("body")),
    longDescriptionHtml: $("#tab-description").length ? cleanHtml($, $("#tab-description")) : null,
    price: price != null ? Number(price) : null,
    priceText,
    sku: ld?.sku || null,
    brand: typeof ld?.brand === "string" ? ld.brand : ld?.brand?.name ?? null,
    inStock: offers?.availability ? /InStock/.test(offers.availability) : null,
    images: gallery($),
    breadcrumbs: crumbs,
    categoryPath: crumbs.filter((c) => c.path && c.path !== "/").slice(-1)[0]?.path ?? null,
    ...meta($),
  };
}

/** Listing (met paginering): verzamelt alle product-links. */
async function listing(url, hrefPrefix) {
  const found = [];
  let first = null;
  for (let page = 1; page < 40; page++) {
    const u = page === 1 ? url : `${url}page/${page}/`;
    const html = await get(u);
    if (!html) break;
    const $ = cheerio.load(html);
    if (page === 1) first = $;
    const links = $("ul.product-list li.product-item > a")
      .map((_, a) => link($(a).attr("href")))
      .get()
      .filter((h) => !hrefPrefix || h.startsWith(hrefPrefix));
    const sale = $("ul.product-list li.product-item")
      .filter((_, li) => $(li).find(".img-sale").length > 0)
      .map((_, li) => link($(li).find("> a").attr("href")))
      .get();
    const fresh = links.filter((l) => !found.some((f) => f.path === l));
    if (!fresh.length) break;
    fresh.forEach((p) => found.push({ path: p, sale: sale.includes(p) }));
    if (!$(`a[href*="page/${page + 1}/"]`).length) break;
  }
  return { items: found, $: first };
}

function archiveInfo($) {
  return {
    h1: text($(".archive-title h1").first().text()),
    introHtml: $(".desinfo").length ? cleanHtml($, $(".desinfo").first()) : "",
    // tekst onder de producten (SEO-blok)
    bottomHtml: (() => {
      const $after = $("main .grid > ul.product-list").nextAll().not(".paging");
      return $after.length ? cleanHtml($, cheerio.load(`<div>${$after.map((_, el) => $.html(el)).get().join("")}</div>`)("div").first()) : "";
    })(),
    parentPath: $(".filters__back").attr("href") ? link($(".filters__back").attr("href")) : null,
    ...meta($),
  };
}

// ---------- pagina's en blogs ----------
function heroImage($) {
  const h = $(".hero .back-img img, .hero img").first();
  return h.length ? { src: img(bestSrc(h)), alt: h.attr("alt") ?? "" } : null;
}

function contentRoot($) {
  const $b = $("body").clone();
  $b.find("header.site-header, footer, .footer, #cookie-law-info-bar, .cky-consent-container").remove();
  return $b;
}

function parsePage($, url) {
  const $r = contentRoot($);
  const h1 = text($r.find("h1").first().text());
  const hero = heroImage($);
  $r.find(".hero").each((_, el) => {
    $(el).find("h1").remove();
  });
  $r.find(".hero .back-img").remove();
  $r.find("h1").first().remove();
  const faqs = [];
  $r.find("details").each((_, el) => {
    const q = text($(el).find("summary").first().text());
    const a = text($(el).clone().find("summary").remove().end().text());
    if (q && a) faqs.push({ q, a });
  });
  $r.find(".elementor-accordion-item, .elementor-toggle-item").each((_, el) => {
    const q = text($(el).find(".elementor-tab-title").text());
    const a = text($(el).find(".elementor-tab-content").text());
    if (q && a) faqs.push({ q, a });
  });
  const html = cleanHtml($, $r);
  return { path: pathOf(url), h1, hero, html, faqs, words: words(html), ...meta($) };
}

function parsePost($, url) {
  const $r = contentRoot($);
  const crumbs = breadcrumbs($);
  const h1 = text($r.find("h1").first().text());
  const hero = heroImage($) ?? (() => {
    const i = $r.find(".elementor-widget-theme-post-featured-image img").first();
    return i.length ? { src: img(bestSrc(i)), alt: i.attr("alt") ?? "" } : null;
  })();
  const cats = $r
    .find(".elementor-post-info__terms-list a")
    .map((_, a) => link($(a).attr("href")))
    .get();
  const dateText = text($r.find(".elementor-post-info time").first().text()) || null;
  $r.find(".hero, .elementor-widget-theme-post-featured-image").remove();
  $r.find("h1").first().remove();
  // Gerelateerde blogs / sliders onder het artikel horen niet bij de tekst
  $r.find(".elementor-widget-posts, .elementor-widget-loop-grid, .related").remove();
  const html = cleanHtml($, $r);
  return { path: pathOf(url), slug: pathOf(url).split("/").filter(Boolean).pop(), h1, hero, categories: cats, breadcrumbs: crumbs, dateText, html, words: words(html), ...meta($) };
}

function parseRealBride($, url) {
  const $r = contentRoot($);
  const h1 = text($r.find("h1, .elementor-heading-title").first().text());
  const info = $r
    .find(".elementor-post-info__item")
    .map((_, el) => text($(el).text()))
    .get();
  const gallery = $r
    .find("a.e-gallery-item, .gallery-item a, .elementor-image-gallery a")
    .map((_, a) => img($(a).attr("href")))
    .get()
    .filter(Boolean);
  const featured = $r.find("img.wp-post-image, .elementor-widget-theme-post-featured-image img, img[class*='wp-image']").first();
  const body = $r.find(".elementor-widget-theme-post-content").first();
  const bodyHtml = body.length ? cleanHtml($, body) : "";
  const dressLinks = $r
    .find("a[href*='/trouwjurken/'], a[href*='/pakken/']")
    .map((_, a) => link($(a).attr("href")))
    .get()
    .filter((p) => /^\/(trouwjurken|pakken)\/[^/]+\/$/.test(p));
  return {
    path: pathOf(url),
    slug: pathOf(url).split("/").filter(Boolean).pop(),
    name: h1,
    date: info.find((s) => /\d{1,2}\/\d{1,2}\/\d{4}/.test(s)) ?? null,
    photographer: info.find((s) => s.includes("@"))?.replace(/^'/, "") ?? null,
    image: featured.length ? img(bestSrc(featured)) : gallery[0] ?? null,
    gallery: [...new Set(gallery)],
    html: bodyHtml,
    products: [...new Set(dressLinks)],
    ...meta($),
  };
}

// ---------- homepage ----------
function parseHome($) {
  const $r = contentRoot($);
  const heroImgs = $r
    .find(".hero img, .elementor-widget-image img, .elementor-background-slideshow__slide__image")
    .slice(0, 12)
    .map((_, el) => img(bestSrc($(el))) ?? img(/url\(([^)]+)\)/.exec($(el).attr("style") ?? "")?.[1]?.replace(/['"]/g, "")))
    .get()
    .filter(Boolean);
  const videos = $r
    .find("video source, video")
    .map((_, el) => $(el).attr("src"))
    .get()
    .filter(Boolean);
  return { html: cleanHtml($, $r), heroImgs, videos, ...meta($) };
}

// ---------- uitvoeren ----------
async function mapAll(list, fn) {
  return (await Promise.all(list.map(fn))).filter(Boolean);
}

function write(name, data) {
  fs.writeFileSync(path.join(OUT, `${name}.json`), JSON.stringify(data, null, 2));
  console.log(`✓ content/${name}.json (${Array.isArray(data) ? data.length : Object.keys(data).length})`);
}

async function main() {
  const [pageSm, postSm, dressSm, suitSm, productSm, rbSm, catSm, productCatSm, dressCatSm, suitCatSm] = await Promise.all(
    ["page-sitemap", "post-sitemap", "dress-sitemap", "suit-sitemap", "product-sitemap", "real-brides-sitemap", "category-sitemap", "product_cat-sitemap", "dress_cat-sitemap", "suit_cat-sitemap"].map(sitemap),
  );
  const lastmod = Object.fromEntries([...pageSm, ...postSm, ...dressSm, ...suitSm, ...productSm, ...rbSm, ...catSm, ...productCatSm, ...dressCatSm, ...suitCatSm].map((e) => [pathOf(e.loc), e.lastmod]));
  write("lastmod", lastmod);

  console.log("Homepage…");
  const home = parseHome(cheerio.load(await get(`${BASE}/`)));
  write("home", home);

  console.log(`Pagina's (${pageSm.length})…`);
  const pages = await mapAll(
    pageSm.filter((e) => pathOf(e.loc) !== "/" && !SKIP_PAGES.includes(pathOf(e.loc))),
    async (e) => {
      const html = await get(e.loc);
      return html ? { ...parsePage(cheerio.load(html), e.loc), lastmod: e.lastmod } : null;
    },
  );
  // Live pagina's die niet in de sitemap staan maar wel in het menu
  for (const p of ["/vacatures/", "/aanmelden-nieuwsbrief/"]) {
    const html = await get(BASE + p);
    if (html) pages.push({ ...parsePage(cheerio.load(html), BASE + p), lastmod: null });
  }
  // Overzichtspagina's die niet in de page-sitemap staan
  for (const p of ["/trouwjurken/", "/pakken/", "/blog/", "/real-brides/", "/shop/"]) {
    const html = await get(BASE + p);
    if (html) pages.push({ ...parsePage(cheerio.load(html), BASE + p), archive: archiveInfo(cheerio.load(html)), lastmod: lastmod[p] ?? null });
  }
  write("pages", pages);
  // Redirects die de huidige site al gebruikt (gevonden doordat sitemap-URL's doorverwijzen)
  write("redirects", [
    ["/de-winkel/veelgestelde-vragen/huren-en-tweedehands/", "/de-winkel/veelgestelde-vragen/"],
    ["/de-winkel/veelgestelde-vragen/accessoires/", "/de-winkel/veelgestelde-vragen/"],
    ["/de-winkel/veelgestelde-vragen/prijzen/", "/de-winkel/veelgestelde-vragen/"],
    ["/de-winkel/veelgestelde-vragen/servicepunten/", "/de-winkel/veelgestelde-vragen/"],
    ["/de-winkel/veelgestelde-vragen/de-collectie/", "/de-winkel/veelgestelde-vragen/"],
    ["/de-winkel/veelgestelde-vragen/afpassen/", "/de-winkel/veelgestelde-vragen/"],
    ["/accessoires/designers/", "/bruid/accessoires/"],
    ["/accessoires/", "/bruid/accessoires/"],
    ["/shop/", "/bruid/accessoires/"],
    ["/accessoires/service-pagina-webshop/acties-webwinkel/", "/"],
    ["/de-winkel/service-punten/", "/de-winkel/"],
    ["/tailored-wedding-suits-event/bedankt/", "/"],
    ["/big-bliss/", "/trouwjurken/big-bliss/"],
    ["/bruidegom/korting-op-trouwpak/", "/perfect-match/"],
    ["/mattie-mariekes-wedding-in-a-week/", "/"],
    ["/de-winkel/10-redenen-om-trouwkleding-honeymoon-shop-kopen/", "/de-winkel/over-de-honeymoon-shop/"],
    ["/vacature/", "/vacatures/"],
    ["/real-bride/", "/real-brides/"],
    ["/trouwjurken/stijl-jurk/strak/", "/trouwjurken/strak/"],
    ["/trouwjurken/stijl-jurk/simpel/", "/trouwjurken/simpel/"],
    ["/trouwjurken/top/recht-top/", "/trouwjurken/recht-top/"],
  ].map(([from, to]) => ({ from, to })));

  console.log(`Blogs (${postSm.length})…`);
  const posts = await mapAll(postSm, async (e) => {
    const html = await get(e.loc);
    return html ? { ...parsePost(cheerio.load(html), e.loc), lastmod: e.lastmod } : null;
  });
  write("posts", posts);
  const blogCats = await mapAll(catSm, async (e) => {
    const html = await get(e.loc);
    if (!html) return null;
    const $ = cheerio.load(html);
    return { path: pathOf(e.loc), slug: pathOf(e.loc).split("/").filter(Boolean).pop(), name: text($("h1").first().text()) || text($(".breadcrumbs .item").last().text()), introHtml: $(".archive-description, .taxonomy-description, .elementor-widget-archive-description").length ? cleanHtml($, $(".archive-description, .taxonomy-description, .elementor-widget-archive-description").first()) : "", ...meta($), lastmod: e.lastmod };
  });
  write("blog-categories", blogCats);

  console.log(`Trouwjurken (${dressSm.length})…`);
  const dresses = await mapAll(dressSm, async (e) => {
    if (pathOf(e.loc) === "/trouwjurken/" || /__trashed/.test(e.loc)) return null;
    const html = await get(e.loc);
    const d = html ? parseGarment(cheerio.load(html), e.loc, "dress") : null;
    return d ? { ...d, lastmod: e.lastmod } : null;
  });
  console.log(`Trouwpakken (${suitSm.length})…`);
  const suits = await mapAll(suitSm, async (e) => {
    if (pathOf(e.loc) === "/pakken/") return null;
    const html = await get(e.loc);
    const d = html ? parseGarment(cheerio.load(html), e.loc, "suit") : null;
    return d ? { ...d, lastmod: e.lastmod } : null;
  });

  // Filters (taxonomieën) per jurk/pak: elke filterpagina doorlopen
  console.log("Filters…");
  async function filtersFor(listUrl, prefix) {
    const $ = cheerio.load((await get(listUrl)) ?? "");
    const groups = [];
    $(".filters .filtergroup").each((_, g) => {
      const name = text($(g).children("span").first().text());
      const terms = $(g)
        .find("ul a")
        .map((_, a) => ({ name: text($(a).text()), path: link($(a).attr("href")) }))
        .get();
      groups.push({ name, terms });
    });
    const cats = $(".sidebar .cats a")
      .map((_, a) => ({ name: text($(a).text()), path: link($(a).attr("href")) }))
      .get();
    for (const g of groups) {
      await Promise.all(
        g.terms.map(async (t) => {
          const { items } = await listing(BASE + t.path, prefix);
          t.items = items.map((i) => i.path);
        }),
      );
    }
    return { groups, cats };
  }
  const dressFilters = await filtersFor(`${BASE}/trouwjurken/`, "/trouwjurken/");
  const suitFilters = await filtersFor(`${BASE}/pakken/`, "/pakken/");

  // Collecties (dress_cat / suit_cat) + overzicht (volgorde en sale-stickers)
  const collections = [];
  for (const e of [...dressCatSm, ...suitCatSm]) {
    const { items, $ } = await listing(e.loc);
    if (!$) continue;
    collections.push({ path: pathOf(e.loc), kind: pathOf(e.loc).startsWith("/pakken/") ? "suit" : "dress", ...archiveInfo($), items: items.map((i) => i.path), lastmod: e.lastmod });
  }
  const dressOrder = await listing(`${BASE}/trouwjurken/`, "/trouwjurken/");
  const suitOrder = await listing(`${BASE}/pakken/`, "/pakken/");

  const attach = (list, filters, order) =>
    list.map((g) => {
      const attrs = {};
      for (const grp of filters.groups) {
        const vals = grp.terms.filter((t) => t.items?.includes(g.path)).map((t) => t.name);
        if (vals.length) attrs[grp.name] = vals;
      }
      const idx = order.items.findIndex((i) => i.path === g.path);
      return { ...g, attributes: attrs, collections: collections.filter((c) => c.items.includes(g.path)).map((c) => c.path), sale: order.items[idx]?.sale ?? false, sortOrder: idx === -1 ? 9999 : idx, inListing: idx !== -1 };
    });
  write("dresses", attach(dresses, dressFilters, dressOrder));
  write("suits", attach(suits, suitFilters, suitOrder));
  write("filters", {
    dress: dressFilters.groups.map((g) => ({ name: g.name, terms: g.terms.map((t) => ({ name: t.name, slug: t.path.split("/").filter(Boolean).pop() })) })),
    suit: suitFilters.groups.map((g) => ({ name: g.name, terms: g.terms.map((t) => ({ name: t.name, slug: t.path.split("/").filter(Boolean).pop() })) })),
  });
  write("collections", collections);

  console.log(`Accessoires (${productSm.length})…`);
  const products = await mapAll(productSm, async (e) => {
    if (pathOf(e.loc) === "/shop/") return null;
    const html = await get(e.loc);
    const p = html ? parseProduct(cheerio.load(html), e.loc) : null;
    return p ? { ...p, lastmod: e.lastmod } : null;
  });
  write("products", products);

  console.log(`Productcategorieën (${productCatSm.length})…`);
  const productCats = [];
  for (const e of productCatSm) {
    if (/uncategorized/.test(e.loc)) continue;
    const { items, $ } = await listing(e.loc);
    if (!$) continue;
    productCats.push({ path: pathOf(e.loc), ...archiveInfo($), products: items.map((i) => i.path), lastmod: e.lastmod });
  }
  write("product-categories", productCats);

  console.log(`Real brides (${rbSm.length})…`);
  const realBrides = await mapAll(rbSm, async (e) => {
    if (pathOf(e.loc) === "/real-brides/") return null;
    const html = await get(e.loc);
    const r = html ? parseRealBride(cheerio.load(html), e.loc) : null;
    return r ? { ...r, lastmod: e.lastmod } : null;
  });
  write("real-brides", realBrides);

  write("images", Object.fromEntries(images));
  console.log(`\nKlaar. ${images.size} afbeeldingen geregistreerd → npm run images`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
