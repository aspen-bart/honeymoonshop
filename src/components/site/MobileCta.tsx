"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/Icon";

/** Vaste afspraakknop onderaan op mobiel (doel van de site = afspraken), niet op de afsprakenpagina's zelf. */
export function MobileCta() {
  const pathname = usePathname() ?? "";
  if (pathname.startsWith("/afspraak-maken/")) return null;
  return (
    <div className="sticky bottom-0 z-30 border-t border-line bg-white/95 p-3 backdrop-blur sm:hidden">
      <Link href="/afspraak-maken/" className="btn-primary w-full !py-3.5">
        <Icon name="calendar" className="h-4 w-4" /> Maak een pasafspraak
      </Link>
    </div>
  );
}
