import "server-only";
import type { Metadata } from "next";
import { SITE_URL, absUrl, type SiteSettings } from "./settings";
import { clip, plain } from "./text";

// Eén herbruikbare SEO-laag: elke route bouwt zijn metadata via buildMetadata() en zijn JSON-LD via de
// helpers hieronder. Alle URL's zijn absoluut, https, met www en met slash aan het eind.

export type Crumb = { name: string; path: string };

const BRAND = "Honeymoon shop";

export function canonical(path: string) {
  const clean = path.split(/[?#]/)[0];
  return `${SITE_URL}${clean.endsWith("/") ? clean : `${clean}/`}`;
}

/** og:image van 1200×630: /og/<bestandsnaam>.jpg snijdt de uploads op maat (zie app/og/[file]/route.ts). */
export function ogImageUrl(src?: string | null) {
  if (!src) return `${SITE_URL}/og/default.jpg`;
  if (src.startsWith("/uploads/")) return `${SITE_URL}/og/${src.slice("/uploads/".length).replace(/\.webp$/, "")}.jpg`;
  return absUrl(src);
}

/** Titel met merknaam erachter, tenzij die er al in staat. */
export function withBrand(title: string) {
  return /honeymoon ?shop/i.test(title) ? title : `${title} | ${BRAND}`;
}

export function describe(text: string | null | undefined, fallbackHtml?: string | null) {
  const base = (text && text.trim()) || plain(fallbackHtml);
  return clip(base.replace(/\.\.\.$/, "…"), 160);
}

export function buildMetadata(opts: { title: string; description: string; path: string; image?: string | null; type?: "website" | "article"; noindex?: boolean; publishedTime?: Date; modifiedTime?: Date }): Metadata {
  const url = canonical(opts.path);
  const image = ogImageUrl(opts.image);
  // Nooit een lege description: val terug op een beschrijvende zin met de (unieke) titel.
  if (!opts.description) opts = { ...opts, description: clip(`${opts.title.replace(/ ?[-|–] ?Honeymoon ?shop$/i, "")}: bekijk het bij de Honeymoon shop in Rotterdam, dé bruidswinkel voor trouwjurken, trouwpakken en accessoires.`, 160) };
  return {
    title: { absolute: opts.title },
    description: opts.description,
    alternates: opts.noindex ? undefined : { canonical: url },
    robots: opts.noindex ? { index: false, follow: true } : { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
    openGraph: {
      title: opts.title,
      description: opts.description,
      url,
      siteName: BRAND,
      locale: "nl_NL",
      type: opts.type ?? "website",
      images: [{ url: image, width: 1200, height: 630, alt: opts.title }],
      ...(opts.type === "article" && opts.publishedTime ? { publishedTime: opts.publishedTime.toISOString(), modifiedTime: opts.modifiedTime?.toISOString() } : {}),
    },
    twitter: { card: "summary_large_image", title: opts.title, description: opts.description, images: [image] },
  };
}

// ---------- JSON-LD ----------

const ORG_ID = `${SITE_URL}/#organization`;
const SITE_ID = `${SITE_URL}/#website`;
const STORE_ID = `${SITE_URL}/#store`;

const DAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function organizationLd(site: SiteSettings) {
  return [
    {
      "@type": "Organization",
      "@id": ORG_ID,
      name: site.name,
      legalName: site.legalName,
      url: `${SITE_URL}/`,
      logo: { "@type": "ImageObject", url: `${SITE_URL}/logo.png`, width: 1320, height: 300 },
      email: site.email,
      telephone: site.phoneIntl,
      sameAs: Object.values(site.socials).filter(Boolean),
      address: { "@type": "PostalAddress", streetAddress: site.street, postalCode: site.postalCode, addressLocality: site.city, addressCountry: site.country },
      contactPoint: { "@type": "ContactPoint", telephone: site.phoneIntl, email: site.email, contactType: "customer service", availableLanguage: ["nl", "en"] },
      ...(site.kvk ? { identifier: { "@type": "PropertyValue", propertyID: "KvK", value: site.kvk } } : {}),
    },
    {
      "@type": "WebSite",
      "@id": SITE_ID,
      name: site.name,
      url: `${SITE_URL}/`,
      publisher: { "@id": ORG_ID },
      inLanguage: "nl-NL",
      potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/zoeken/?q={search_term_string}` }, "query-input": "required name=search_term_string" },
    },
  ];
}

export function storeLd(site: SiteSettings) {
  return {
    "@type": "ClothingStore",
    "@id": STORE_ID,
    name: site.name,
    description: site.tagline,
    url: `${SITE_URL}/`,
    image: `${SITE_URL}/og/default.jpg`,
    logo: `${SITE_URL}/logo.png`,
    telephone: site.phoneIntl,
    email: site.email,
    priceRange: "€€",
    parentOrganization: { "@id": ORG_ID },
    address: { "@type": "PostalAddress", streetAddress: site.street, postalCode: site.postalCode, addressLocality: site.city, addressCountry: site.country },
    openingHoursSpecification: site.openingHours.map((h) => ({ "@type": "OpeningHoursSpecification", dayOfWeek: h.days.map((d) => DAY[d]), opens: h.opens, closes: h.closes })),
    hasMap: site.googleRating.url,
  };
}

export function breadcrumbLd(crumbs: Crumb[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: [{ name: "Home", path: "/" }, ...crumbs].map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: canonical(c.path) })),
  };
}

export function faqLd(items: { q: string; a: string }[]) {
  return { "@type": "FAQPage", mainEntity: items.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) };
}

export function itemListLd(name: string, items: { name: string; path: string }[]) {
  return { "@type": "ItemList", name, numberOfItems: items.length, itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, url: canonical(it.path), name: it.name })) };
}

export function productLd(p: { name: string; path: string; description: string; images: string[]; sku?: string | null; brand?: string | null; priceMin?: number | null; priceMax?: number | null; price?: number | null; category?: string }) {
  const offers =
    p.price != null
      ? { "@type": "Offer", price: p.price.toFixed(2), priceCurrency: "EUR", availability: "https://schema.org/InStoreOnly", url: canonical(p.path), seller: { "@id": ORG_ID } }
      : p.priceMin != null
        ? { "@type": "AggregateOffer", lowPrice: p.priceMin, highPrice: p.priceMax ?? p.priceMin, priceCurrency: "EUR", availability: "https://schema.org/InStoreOnly", url: canonical(p.path), seller: { "@id": ORG_ID } }
        : undefined;
  return {
    "@type": "Product",
    "@id": `${canonical(p.path)}#product`,
    name: p.name,
    url: canonical(p.path),
    description: p.description,
    image: p.images.map((i) => absUrl(i)),
    ...(p.sku ? { sku: p.sku } : {}),
    ...(p.brand ? { brand: { "@type": "Brand", name: p.brand } } : {}),
    ...(p.category ? { category: p.category } : {}),
    ...(offers ? { offers } : {}),
  };
}

export function articleLd(a: { title: string; path: string; description: string; image?: string | null; published: Date; modified: Date; section?: string | null }) {
  return {
    "@type": "BlogPosting",
    "@id": `${canonical(a.path)}#article`,
    headline: a.title,
    description: a.description,
    mainEntityOfPage: canonical(a.path),
    ...(a.image ? { image: [absUrl(a.image)] } : {}),
    datePublished: a.published.toISOString(),
    dateModified: a.modified.toISOString(),
    inLanguage: "nl-NL",
    ...(a.section ? { articleSection: a.section } : {}),
    author: { "@type": "Organization", name: "Team Honeymoon shop", url: canonical("/team/") },
    publisher: { "@id": ORG_ID },
  };
}

export function graph(...nodes: (object | object[] | null | undefined | false)[]) {
  return { "@context": "https://schema.org", "@graph": nodes.flat().filter(Boolean) };
}
