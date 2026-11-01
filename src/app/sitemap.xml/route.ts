import { sitemapIndexXml } from "@/lib/sitemap";

export const revalidate = 3600;
export const GET = () => sitemapIndexXml();
