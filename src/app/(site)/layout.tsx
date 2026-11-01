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
import { SITE_URL, getConnections, getSite } from "@/lib/settings";

const display = Cormorant_Garamond({ subsets: ["latin"], weight: ["400", "500", "600", "700"], style: ["normal", "italic"], variable: "--font-display", display: "swap" });
const body = Jost({ subsets: ["latin"], weight: ["300", "400", "500", "600"], variable: "--font-body", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: "Honeymoon shop",
  icons: { apple: "/apple-touch-icon.png" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = { themeColor: "#2b2843", width: "device-width", initialScale: 1 };

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [site, connections] = await Promise.all([getSite(), getConnections()]);
  const gtm = connections.gtm.enabled && GTM_ID.test(connections.gtm.containerId) ? connections.gtm.containerId : null;
  return (
    <html lang="nl" className={`${display.variable} ${body.variable}`}>
      <head>{gtm && <GtmHead id={gtm} />}</head>
      <body className="flex min-h-dvh flex-col">
        {gtm && <GtmBody id={gtm} />}
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
