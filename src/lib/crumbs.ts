import "server-only";
import { db } from "./db";
import type { Crumb } from "./seo";

// Kruimelpad uit de URL-structuur: elk tussenliggend pad dat als pagina of categorie bestaat, wordt een kruimel.
const FIXED: Record<string, string> = {
  "/trouwjurken/": "Trouwjurken",
  "/pakken/": "Trouwpakken",
  "/blog/": "Blog",
  "/real-brides/": "Real Brides & Grooms",
  "/afspraak-maken/": "Afspraak maken",
};

export async function crumbsFor(path: string, lastName: string, extra: Crumb[] = []): Promise<Crumb[]> {
  const parts = path.split("/").filter(Boolean);
  const prefixes = parts.slice(0, -1).map((_, i) => `/${parts.slice(0, i + 1).join("/")}/`);
  const [pages, cats] = await Promise.all([
    db.page.findMany({ where: { path: { in: prefixes }, status: "published" }, select: { path: true, title: true } }),
    db.category.findMany({ where: { path: { in: prefixes }, status: "published" }, select: { path: true, name: true } }),
  ]);
  const out: Crumb[] = [];
  for (const p of prefixes) {
    const name = FIXED[p] ?? pages.find((x) => x.path === p)?.title ?? cats.find((x) => x.path === p)?.name;
    if (name) out.push({ name, path: p });
  }
  return [...out, ...extra, { name: lastName, path }];
}
