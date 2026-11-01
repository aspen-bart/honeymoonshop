import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

// 1) /admin/ afschermen (pagina's en server actions controleren rechten daarnaast zelf).
// 2) Eén vorm per URL: https + www (productie) en altijd een slash aan het eind → in één stap een 301.
// 3) Redirects uit het beheer (/admin/redirects/), o.a. de oude WordPress-doorverwijzingen.
// 4) X-Robots-Tag noindex op alles wat niet het productiedomein is (previews, test-hosts).
const PROD_HOST = new URL(process.env.SITE_URL || "https://www.honeymoonshop.nl").host;

let cache: { at: number; map: Map<string, { to: string; status: number }> } | null = null;
async function redirects() {
  if (cache && Date.now() - cache.at < 60_000) return cache.map;
  try {
    const rows = await db.redirect.findMany({ select: { from: true, to: true, status: true } });
    cache = { at: Date.now(), map: new Map(rows.map((r) => [r.from, { to: r.to, status: r.status }])) };
  } catch {
    cache = { at: Date.now(), map: cache?.map ?? new Map() };
  }
  return cache.map;
}

export async function middleware(req: NextRequest) {
  // Bewust een gewone URL: NextURL past trailingSlash zelf aan bij het formatteren.
  const url = new URL(req.url);
  const { pathname } = url;
  const host = req.headers.get("host") ?? "";
  const isFile = /\.[a-z0-9]{2,5}$/i.test(pathname);
  const isApi = pathname.startsWith("/api/") || pathname.startsWith("/_next/");

  if (pathname.startsWith("/admin")) {
    if (!pathname.endsWith("/") && !isFile) {
      url.pathname = `${pathname}/`;
      return NextResponse.redirect(url, 301);
    }
    if (pathname.startsWith("/admin/login/")) return NextResponse.next();
    const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
    if (!session) {
      url.pathname = "/admin/login/";
      url.search = `?terug=${encodeURIComponent(pathname)}`;
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }
  if (isApi) return NextResponse.next();

  // Canonieke host en protocol (alleen op het eigen domein, niet lokaal of op previews)
  let changed = false;
  if (process.env.NODE_ENV === "production" && /(^|\.)honeymoonshop\.nl$/.test(host.split(":")[0])) {
    if (host !== PROD_HOST) {
      url.host = PROD_HOST;
      url.port = "";
      changed = true;
    }
    if (req.headers.get("x-forwarded-proto") === "http") {
      url.protocol = "https:";
      changed = true;
    }
  }
  if (!isFile && !pathname.endsWith("/")) {
    url.pathname = `${pathname}/`;
    changed = true;
  }
  const target = (await redirects()).get(url.pathname.toLowerCase());
  if (target) {
    const dest = new URL(target.to, url);
    dest.search = url.search;
    return NextResponse.redirect(dest, target.status === 302 ? 302 : 301);
  }
  if (changed) return NextResponse.redirect(url, 301);

  const res = NextResponse.next();
  if (host && host !== PROD_HOST) res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

export const config = {
  runtime: "nodejs",
  matcher: ["/((?!_next/static|_next/image|uploads/|og/|favicon.ico|icon.png|icon-512.png|apple-touch-icon.png|logo.png).*)"],
};
