import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/Icon";

export const metadata: Metadata = { title: { absolute: "Pagina niet gevonden | Honeymoon shop" }, robots: { index: false, follow: true } };

export default function NotFound() {
  return (
    <section className="container-x grid min-h-[70vh] items-center py-20">
      <div className="max-w-3xl">
        <p className="eyebrow text-lilac-700">Foutcode 404</p>
        <h1 className="mt-4 text-6xl sm:text-7xl">
          Deze pagina zegt helaas <em>nee</em>
        </h1>
        <p className="mt-5 text-lg text-ink-soft">De pagina die je zoekt bestaat niet (meer) of is verplaatst. Misschien vind je hier wat je zoekt:</p>
        <ul className="mt-8 grid gap-3 sm:grid-cols-2">
          {[
            ["/trouwjurken/", "Alle trouwjurken"],
            ["/pakken/", "Alle trouwpakken"],
            ["/afspraak-maken/", "Een pasafspraak maken"],
            ["/bruid/accessoires/", "Bruidsaccessoires"],
            ["/blog/", "Blog en inspiratie"],
            ["/contact/", "Contact met de winkel"],
          ].map(([href, label]) => (
            <li key={href}>
              <Link href={href} className="flex items-center justify-between rounded-2xl border border-line px-5 py-4 transition hover:border-ink">
                {label} <Icon name="arrow" className="h-4 w-4" />
              </Link>
            </li>
          ))}
        </ul>
        <Link href="/" className="btn-primary mt-10">
          Terug naar de homepage
        </Link>
      </div>
    </section>
  );
}
