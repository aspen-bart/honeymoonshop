import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Jost } from "next/font/google";
import "../globals.css";
import { CookieConsent } from "@/components/site/CookieConsent";
import { Footer } from "@/components/site/Footer";
import { GTM_ID, GtmBody, GtmHead } from "@/components/site/Gtm";
import { Header } from "@/components/site/Header";
import { JsonLd } from "@/components/site/JsonLd";
import { MobileCta } from "@/components/site/MobileCta";
import { graph, organizationLd } from "@/lib/seo";
import { SITE_URL, getConnections, getSeo, getSite } from "@/lib/settings";

const display = Cormorant_Garamond({ subsets: ["latin"], weight: ["400", "500", "600", "700"], style: ["normal", "italic"], variable: "--font-display", display: "swap" });
const body = Jost({ subsets: ["latin"], weight: ["300", "400", "500", "600"], variable: "--font-body", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getSeo();
  return {
    metadataBase: new URL(SITE_URL),
    applicationName: "Honeymoon shop",
    icons: { apple: "/apple-touch-icon.png" },
    formatDetection: { telephone: false },
    verification: { ...(seo.googleVerification ? { google: seo.googleVerification } : {}), ...(seo.bingVerification ? { other: { "msvalidate.01": seo.bingVerification } } : {}) },
  };
}

/** Extra code uit Connecties → Tag Manager (tekstvak): als HTML-fragment invoegen, scripts worden dan ook uitgevoerd. */
function ExtraCode({ html, target }: { html: string; target: "head" | "body" }) {
  if (!html.trim()) return null;
  const js = `(function(){var f=document.createRange().createContextualFragment(${JSON.stringify(html).replace(/</g, "\\u003c")});document.${target}.${target === "head" ? "appendChild(f)" : "insertBefore(f,document.body.firstChild)"};})();`;
  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}

export const viewport: Viewport = { themeColor: "#2b2843", width: "device-width", initialScale: 1 };

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [site, connections] = await Promise.all([getSite(), getConnections()]);
  const gtm = connections.gtm.enabled && GTM_ID.test(connections.gtm.containerId) ? connections.gtm.containerId : null;
  return (
    <html lang="nl" className={`${display.variable} ${body.variable}`}>
      <head>
        {gtm && <GtmHead id={gtm} />}
        {gtm && <ExtraCode html={connections.gtm.headCode} target="head" />}
      </head>
      <body className="flex min-h-dvh flex-col">
        {gtm && <GtmBody id={gtm} />}
        {gtm && <ExtraCode html={connections.gtm.bodyCode} target="body" />}
        <a href="#main" className="sr-only z-[100] rounded-full bg-ink px-5 py-3 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
          Naar de inhoud
        </a>
        <Header phone={site.phone} phoneIntl={site.phoneIntl} topbar={site.topbar} rating={site.googleRating} />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer site={site} consentEnabled={!!gtm} />
        <MobileCta />
        {gtm && <CookieConsent />}
        <JsonLd data={graph(organizationLd(site))} />
      </body>
    </html>
  );
}
