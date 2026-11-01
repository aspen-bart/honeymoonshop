import "server-only";
import { cache } from "react";
import { db } from "./db";

// CMS-HTML klaarmaken voor weergave: externe links in een nieuw tabblad (met rel en schermlezertekst),
// afbeeldingen met width/height en lazy loading, tabellen scrollbaar op mobiel.

const mediaSizes = cache(async () => {
  const rows = await db.media.findMany({ select: { path: true, width: true, height: true } });
  return new Map(rows.map((r) => [r.path, r]));
});

export function isExternal(href: string) {
  if (!/^https?:\/\//i.test(href)) return false;
  try {
    const host = new URL(href).hostname;
    return !/(^|\.)honeymoonshop\.nl$/i.test(host);
  } catch {
    return false;
  }
}

const redirectMap = cache(async () => {
  const rows = await db.redirect.findMany({ select: { from: true, to: true } });
  return new Map(rows.map((r) => [r.from, r.to]));
});

/** Oude/kapotte interne links uit geïmporteerde content repareren en via redirects naar de eindbestemming sturen. */
function fixInternal(href: string, redirects: Map<string, string>) {
  let h = href.replace(/^\/www\.honeymoonshop\.nl/i, "").replace(/(%20|\s).*$/, "");
  const [p, rest = ""] = h.split(/(?=[?#])/);
  let path = p.endsWith("/") || /\.[a-z0-9]{2,5}$/i.test(p) ? p : `${p}/`;
  for (let i = 0; i < 5 && redirects.has(path); i++) path = redirects.get(path)!;
  h = path + rest;
  return h;
}

export async function renderHtml(html: string | null | undefined, opts: { eagerFirstImage?: boolean } = {}) {
  if (!html) return "";
  const [sizes, redirects] = await Promise.all([mediaSizes(), redirectMap()]);
  let first = true;
  return html
    .replace(/<a ([^>]*?)href="([^"]+)"([^>]*)>([\s\S]*?)<\/a>/g, (all, pre: string, href: string, post: string, inner: string) => {
      if (href.startsWith("/")) return `<a ${pre}href="${fixInternal(href, redirects)}"${post}>${inner}</a>`;
      if (/^https?:\/\//i.test(href)) {
        try {
          if (!new URL(href).hostname.includes(".")) return inner;
        } catch {
          return inner; // ongeldige link uit de oude content: alleen de tekst tonen
        }
      }
      if (!isExternal(href)) return all;
      const rel = /rel="[^"]*(sponsored|ugc)[^"]*"/.exec(pre + post)?.[1];
      const attrs = `${pre}${post}`.replace(/\s*(target|rel)="[^"]*"/g, "");
      return `<a ${attrs.trim() ? `${attrs.trim()} ` : ""}href="${href}" target="_blank" rel="noopener noreferrer${rel ? ` ${rel}` : ""}">${inner}<span class="sr-only"> (opent in een nieuw tabblad)</span></a>`;
    })
    .replace(/<img ([^>]*?)src="([^"]+)"([^>]*?)\/?>/g, (all, pre: string, src: string, post: string) => {
      const attrs = `${pre}${post}`.replace(/\s*(width|height|loading|decoding)="[^"]*"/g, "").trim();
      const s = sizes.get(src);
      const dims = s?.width && s?.height ? ` width="${s.width}" height="${s.height}"` : "";
      const loading = opts.eagerFirstImage && first ? ' fetchpriority="high"' : ' loading="lazy" decoding="async"';
      first = false;
      return `<img ${attrs.includes("alt=") ? attrs : `${attrs} alt=""`} src="${src}"${dims}${loading} />`;
    })
    .replace(/<table>/g, '<div class="table-wrap"><table>')
    .replace(/<\/table>/g, "</table></div>");
}
