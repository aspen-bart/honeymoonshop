import type { MetadataRoute } from "next";
import { SITE_URL, getSeo } from "@/lib/settings";

// Alleen regels voor paden die echt bestaan. Pagina's die niet in de index horen (bedankpagina's, filters,
// favorieten, zoeken) krijgen noindex in de HTML en worden hier bewust níet geblokkeerd. AI-crawlers zijn welkom.
export default async function robots(): Promise<MetadataRoute.Robots> {
  const seo = await getSeo();
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin/", "/api/", ...seo.robotsDisallow] }],
    sitemap: `${SITE_URL}/sitemap_index.xml`,
  };
}
