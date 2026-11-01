import Link from "next/link";
import { Icon } from "@/components/Icon";
import { FOOTER_COLUMNS, LEGAL_LINKS } from "@/lib/menu";
import type { SiteSettings } from "@/lib/settings";
import { CookieSettingsButton } from "./CookieConsent";
import { Logo } from "./Logo";

export function Footer({ site, consentEnabled }: { site: SiteSettings; consentEnabled: boolean }) {
  const year = new Date().getFullYear();
  return (
    <footer className="on-dark bg-ink text-white/85">
      <div className="container-x grid gap-10 border-b border-white/10 py-14 lg:grid-cols-[1.2fr_2fr] lg:gap-16 lg:py-20">
        <div>
          <Logo className="h-[18px] w-auto text-white" />
          <p className="mt-6 max-w-sm font-serif text-3xl leading-tight text-white">
            Zeg <em>ja</em> tegen jouw droomlook — wij nemen alle tijd voor je.
          </p>
          <Link href="/afspraak-maken/" className="btn-white mt-7">
            <Icon name="calendar" className="h-4 w-4" /> Plan je pasafspraak
          </Link>
          <ul className="mt-8 flex gap-2" aria-label="Volg ons">
            {(
              [
                ["facebook", site.socials.facebook, "Facebook"],
                ["instagram", site.socials.instagram, "Instagram"],
                ["pinterest", site.socials.pinterest, "Pinterest"],
                ["youtube", site.socials.youtube, "YouTube"],
              ] as const
            ).map(([icon, href, label]) =>
              href ? (
                <li key={icon}>
                  <a href={href} target="_blank" rel="noopener noreferrer" className="grid h-11 w-11 place-items-center rounded-full border border-white/20 transition hover:bg-white hover:text-ink">
                    <Icon name={icon} className="h-4.5 w-4.5" />
                    <span className="sr-only">{label} (opent in een nieuw tabblad)</span>
                  </a>
                </li>
              ) : null,
            )}
          </ul>
        </div>

        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {FOOTER_COLUMNS.map((col) => (
            <div key={col.title}>
              <h2 className="eyebrow mb-4 font-sans text-lilac">{col.title}</h2>
              <ul className="space-y-2 text-[0.95rem]">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="transition hover:text-white hover:underline">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="col-span-2 sm:col-span-1">
            <h2 className="eyebrow mb-4 font-sans text-lilac">Bezoek ons</h2>
            <address className="space-y-2 text-[0.95rem] not-italic">
              <p>
                {site.street}
                <br />
                {site.postalCode} {site.city}
              </p>
              <p>
                <a href={`tel:${site.phoneIntl}`} className="hover:underline">
                  {site.phone}
                </a>
                <br />
                <a href={`mailto:${site.email}`} className="hover:underline">
                  {site.email}
                </a>
              </p>
            </address>
            <h2 className="eyebrow mb-2 mt-6 font-sans text-lilac">Openingstijden</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-[0.9rem]">
              {site.openingHours.map((h) => (
                <div key={h.label} className="contents">
                  <dt className="font-medium text-white">{h.label}</dt>
                  <dd>
                    {h.opens.replace(":", ".")} – {h.closes.replace(":", ".")}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-sm text-white/60">{site.closedNote}</p>
            <Link href="/bereikbaarheid-en-parkeergelegenheden/" className="mt-3 inline-flex items-center gap-1.5 text-sm underline underline-offset-4">
              <Icon name="pin" className="h-4 w-4" /> Route en parkeren
            </Link>
          </div>
        </div>
      </div>
      <div className="container-x flex flex-col gap-4 py-6 text-sm text-white/60 lg:flex-row lg:items-center lg:justify-between">
        <p>
          © {year} {site.legalName} · KvK {site.kvk}
        </p>
        <ul className="flex flex-wrap gap-x-5 gap-y-2">
          {LEGAL_LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="hover:text-white hover:underline">
                {l.label}
              </Link>
            </li>
          ))}
          {consentEnabled && (
            <li>
              <CookieSettingsButton />
            </li>
          )}
        </ul>
      </div>
    </footer>
  );
}
