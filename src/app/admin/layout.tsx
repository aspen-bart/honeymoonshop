import type { Metadata } from "next";
import { Jost } from "next/font/google";
import "../globals.css";

// Eigen root-layout voor het beheer: geen Google Tag Manager, geen cookiebanner, nooit indexeren.
const body = Jost({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-body" });

export const metadata: Metadata = { title: { default: "Beheer", template: "%s · Beheer Honeymoon shop" }, robots: { index: false, follow: false } };

export default function AdminRoot({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" className={body.variable}>
      <body className="bg-[#f6f5f8] font-sans text-ink">{children}</body>
    </html>
  );
}
