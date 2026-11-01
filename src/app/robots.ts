import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/settings";

// Alleen regels voor paden die echt bestaan. Pagina's die niet in de index horen (bedankpagina's, filters,
// favorieten, zoeken) krijgen noindex in de HTML en worden hier bewust níet geblokkeerd. AI-crawlers zijn welkom.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin/", "/api/"] }],
    sitemap: `${SITE_URL}/sitemap_index.xml`,
  };
}
