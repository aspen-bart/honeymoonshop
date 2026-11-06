import Link from "next/link";
import { Icon } from "@/components/Icon";
import { AppointmentWizard } from "@/components/site/AppointmentWizard";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { CtaBand, FaqList, PageHero } from "@/components/site/blocks";
import { FaqTools } from "@/components/site/FaqTools";
import { ContactForm, FavoritesList, LookBookForm, StoryForm } from "@/components/site/Forms";
import { GoogleReviews } from "@/components/site/GoogleReviews";
import { Html } from "@/components/site/Html";
import { JsonLd } from "@/components/site/JsonLd";
import { window as apptWindow } from "@/lib/appointments";
import { crumbsFor } from "@/lib/crumbs";
import { prepareHtml } from "@/lib/html";
import { db } from "@/lib/db";
import { faqs, parse } from "@/lib/json";
import { breadcrumbLd, faqLd, graph, storeLd } from "@/lib/seo";
import { getAppointmentSettings, getSite } from "@/lib/settings";
import type { Page } from "@prisma/client";

const STORE_PAGES = ["/contact/", "/bereikbaarheid-en-parkeergelegenheden/", "/de-winkel/over-de-honeymoon-shop/", "/de-winkel/"];

export async function PageView({ page }: { page: Page }) {
  const crumbs = await crumbsFor(page.path, page.title);
  const items = faqs(page.faqs);
  const data = parse<Record<string, string | null>>(page.templateData, {});
  const site = await getSite();
  // Directe subpagina's (bv. /afspraak-maken/summersale/ onder /afspraak-maken/) als vervolgnavigatie
  const depth = page.path.split("/").filter(Boolean).length;
  const children =
    page.path === "/"
      ? []
      : (await db.page.findMany({ where: { path: { startsWith: page.path, not: page.path }, status: "published", noindex: false }, select: { path: true, title: true }, orderBy: { title: "asc" } })).filter((c) => c.path.split("/").filter(Boolean).length === depth + 1);
  const childNav = children.length > 0 && (
    <nav aria-label="Meer over dit onderwerp" className="container-x pb-14">
      <h2 className="mb-5 text-3xl">Meer over {page.title.toLowerCase()}</h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {children.map((c) => (
          <li key={c.path}>
            <Link href={c.path} className="flex items-center justify-between rounded-2xl border border-line px-5 py-4 transition hover:border-ink">
              {c.title} <Icon name="arrow" className="h-4 w-4" />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
  const crumbNav = <Breadcrumbs items={crumbs} light={!!page.heroImage && page.template !== "appointment"} />;
  const ld = graph(breadcrumbLd(crumbs), items.length ? faqLd(items) : null, STORE_PAGES.includes(page.path) ? storeLd(site) : null);

  if (page.template === "appointment") {
    const settings = await getAppointmentSettings();
    const { first, last } = apptWindow(settings);
    return (
      <>
        <section className="bg-cream pb-20">
          <div className="container-x pt-8">
            {crumbNav}
            <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_1fr] lg:items-end">
              <h1 className="text-5xl sm:text-6xl lg:text-7xl">{page.title}</h1>
              <p className="text-lg text-ink-soft">Kies je afspraak, datum en tijd: binnen een minuut geregeld. Gratis en vrijblijvend.</p>
            </div>
            <div className="mt-10">
              <AppointmentWizard types={settings.types} initialType={data.type ?? null} firstDate={first} lastDate={last} source={data.source ?? undefined} phone={site.phone} phoneIntl={site.phoneIntl} />
            </div>
          </div>
        </section>
        {page.html && (
          <section className="container-x py-16">
            <Html html={page.html} className="mx-auto max-w-3xl" />
          </section>
        )}
        <GoogleReviews title="Zo ervaren bruidsparen hun pasafspraak" focus={data.type === "trouwpak" ? "suit" : data.type === "trouwjurk" ? "dress" : undefined} tone="white" />
        <section className="container-x grid gap-8 pb-16 md:grid-cols-3">
          {[
            ["Hoe verloopt een pasafspraak?", "Lees wat je kunt verwachten, wie je meeneemt en hoe je je voorbereidt.", "/de-winkel/eerste-pasafspraak/"],
            ["Samen komen passen", "Bruid en bruidegom tegelijk, op aparte verdiepingen: zo blijft je look een verrassing.", "/perfect-match/"],
            ["Route en parkeren", "Midden in Rotterdam, met parkeergarages en tram en metro om de hoek.", "/bereikbaarheid-en-parkeergelegenheden/"],
          ].map(([t, x, href]) => (
            <Link key={href} href={href} className="group rounded-[1.5rem] border border-line p-6 transition hover:border-ink">
              <p className="font-serif text-2xl">{t}</p>
              <p className="mt-2 text-ink-soft">{x}</p>
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-lilac-700">
                {t} <Icon name="arrow" className="h-4 w-4 transition group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
        </section>
        {childNav}
        <JsonLd data={ld} />
      </>
    );
  }

  const form =
    page.template === "contact" ? (
      <div className="grid gap-12 lg:grid-cols-[1.3fr_1fr]">
        <div>
          <h2 className="mb-6 text-4xl">Stuur ons een bericht</h2>
          <ContactForm />
        </div>
        <aside className="space-y-6">
          <div className="rounded-[1.5rem] rounded-tr-[4rem] bg-ink p-7 text-white">
            <p className="eyebrow text-lilac">Bezoek de winkel</p>
            <address className="mt-4 space-y-3 not-italic">
              <p className="flex gap-3">
                <Icon name="pin" className="mt-1 h-5 w-5 shrink-0" />
                <span>
                  {site.street}
                  <br />
                  {site.postalCode} {site.city}
                </span>
              </p>
              <p className="flex gap-3">
                <Icon name="phone" className="mt-1 h-5 w-5 shrink-0" />
                <a href={`tel:${site.phoneIntl}`} className="underline underline-offset-4">
                  {site.phone}
                </a>
              </p>
              <p className="flex gap-3">
                <Icon name="mail" className="mt-1 h-5 w-5 shrink-0" />
                <a href={`mailto:${site.email}`} className="underline underline-offset-4">
                  {site.email}
                </a>
              </p>
            </address>
            <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 border-t border-white/15 pt-5 text-sm">
              {site.openingHours.map((h) => (
                <div key={h.label} className="contents">
                  <dt className="font-medium">{h.label}</dt>
                  <dd>
                    {h.opens.replace(":", ".")} – {h.closes.replace(":", ".")} uur
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-sm text-white/70">{site.closedNote}</p>
          </div>
          <Link href="/afspraak-maken/" className="btn-primary w-full">
            <Icon name="calendar" className="h-4 w-4" /> Liever direct een pasafspraak?
          </Link>
        </aside>
      </div>
    ) : page.template === "newsletter" ? (
      <div className="max-w-2xl">
        <h2 className="mb-6 text-4xl">Ontvang het gratis Look Book</h2>
        <LookBookForm />
      </div>
    ) : page.template === "review-submit" ? (
      <div className="max-w-3xl">
        <h2 className="mb-6 text-4xl">Deel jullie verhaal</h2>
        <StoryForm />
      </div>
    ) : page.template === "favorites" ? (
      <FavoritesList />
    ) : null;

  // Pagina vol veelgestelde vragen (onderwerpen als H2 met uitklapvragen): inhoudsopgave + zoeken naast de vragen
  const prepared = prepareHtml(page.html);
  const topics = prepared
    .split(/(?=<h2 id=")/)
    .map((part) => {
      const m = /^<h2 id="([^"]+)">([\s\S]*?)<\/h2>/.exec(part);
      return m ? { id: m[1], text: m[2].replace(/<[^>]+>/g, "").trim(), count: (part.match(/<details/g) ?? []).length } : null;
    })
    .filter((t): t is { id: string; text: string; count: number } => !!t && t.count > 0);
  if (topics.length >= 3 && !form) {
    const total = topics.reduce((n, t) => n + t.count, 0);
    return (
      <>
        <PageHero title={page.title} crumbs={crumbNav} intro={`${total} antwoorden over trouwjurken, trouwpakken, passen, vermaken en betalen, verdeeld over ${topics.length} onderwerpen.`} />
        <section className="container-x grid grid-cols-1 gap-10 py-12 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-16 lg:py-16">
          <aside className="min-w-0 space-y-6 lg:sticky lg:top-28 lg:max-h-[calc(100dvh-8rem)] lg:self-start lg:overflow-y-auto">
            <FaqTools topics={topics} contentId="faq-content" />
            <div className="hidden rounded-[1.5rem] rounded-tr-[3rem] bg-ink p-6 text-white lg:block">
              <p className="font-serif text-2xl leading-tight text-white">Staat je vraag er niet bij?</p>
              <p className="mt-2 text-sm text-white/80">We helpen je graag persoonlijk verder.</p>
              <Link href="/contact/" className="btn-white mt-4 w-full !py-3">
                Stel je vraag
              </Link>
              <a href={`tel:${site.phoneIntl}`} className="mt-3 flex items-center justify-center gap-2 text-sm text-white/85 underline underline-offset-4">
                <Icon name="phone" className="h-4 w-4" /> {site.phone}
              </a>
            </div>
          </aside>
          <div id="faq-content" className="min-w-0">
            <Html html={page.html} className="max-w-3xl [&_h2]:mt-14 [&_h2:first-child]:mt-0" />
          </div>
        </section>
        {childNav}
        <CtaBand title="Liever persoonlijk advies?" text="Plan je pasafspraak: in de winkel beantwoorden we al je vragen, met alle tijd voor jou." />
        <JsonLd data={ld} />
      </>
    );
  }

  return (
    <>
      <PageHero title={page.title} image={page.heroImage} imageAlt={page.heroAlt} crumbs={crumbNav} narrow={!form && !!page.html} />
      <section className="container-x py-14 lg:py-20">
        {page.html && <Html html={page.html} className={`mx-auto max-w-3xl ${form ? "mb-14" : ""}`} />}
        {form}
        {items.length > 0 && !page.html.includes("<details") && (
          <div className="mx-auto mt-16 max-w-3xl">
            <h2 className="mb-6 text-4xl">Veelgestelde vragen</h2>
            <FaqList items={items} />
          </div>
        )}
      </section>
      {childNav}
      {page.template !== "contact" && <CtaBand />}
      <JsonLd data={ld} />
    </>
  );
}
