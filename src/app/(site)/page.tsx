import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { CtaBand, FaqList, Marquee, PostCard, ReviewCard, SectionHead } from "@/components/site/blocks";
import { Html } from "@/components/site/Html";
import { JsonLd } from "@/components/site/JsonLd";
import { ProductCard } from "@/components/site/ProductCard";
import { featured, featuredReviews, latestPosts } from "@/lib/content";
import { db } from "@/lib/db";
import { faqs } from "@/lib/json";
import { buildMetadata, describe, faqLd, graph, storeLd } from "@/lib/seo";
import { getAppointmentSettings, getHome, getSite } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  const page = await db.page.findUnique({ where: { path: "/" } });
  const home = await getHome();
  return buildMetadata({
    title: page?.metaTitle || "Honeymoon Shop – Dé bruidswinkel in Rotterdam!",
    description: describe(page?.metaDescription, page?.html),
    path: "/",
    image: page?.ogImage || home.heroPoster,
  });
}

export default async function HomePage() {
  const [page, home, site, appt, dresses, suits, reviews, posts, dressCount] = await Promise.all([
    db.page.findUnique({ where: { path: "/" } }),
    getHome(),
    getSite(),
    getAppointmentSettings(),
    featured("dress", 12),
    featured("suit", 8),
    featuredReviews(8),
    latestPosts(3),
    db.product.count({ where: { kind: "dress", status: "published" } }),
  ]);
  const faqItems = faqs(page?.faqs);
  const slides = home.heroImages.length ? home.heroImages : [home.heroPoster];
  const apptCards = [
    { type: appt.types.find((t) => t.key === "trouwjurk"), href: "/afspraak-maken/trouwjurk-passen/", image: "/uploads/hfghfpj1kbqj6djbf7j6z_wyg37p7b_00001-rmasesg0hvjut681200bo5pijl5t30qy424tzi2jjk.webp" },
    { type: appt.types.find((t) => t.key === "trouwpak"), href: "/afspraak-maken/trouwpak-passen/", image: "/uploads/f9garn93u8xzhojyafwtx_bvweu8lg_00001-rmaseri6b1ikhk9e7hlp3ny1y7afvbn7rxhci83xps.webp" },
    { type: appt.types.find((t) => t.key === "perfect-match"), href: "/afspraak-maken/?type=perfect-match", image: "/uploads/j58grxerzovm1xruldvmk_v0sngv4b_00001-e1776713393224-1536x778.webp" },
  ];

  // heroVideo mag een mp4/webm-bestand zijn of een YouTube-link (watch, youtu.be of shorts)
  const youtubeId = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/.exec(home.heroVideo)?.[1] ?? null;

  return (
    <>
      {/* 1. Hero met bewegend beeld */}
      <section className="on-dark relative isolate flex min-h-[100svh] items-end overflow-hidden bg-ink text-white">
        <div className="absolute inset-0 -z-20">
          {youtubeId ? (
            <>
              {/* Poster eerst (snel en zichtbaar zolang de video laadt), daarover de YouTube-video zonder knoppen */}
              <Image src={home.heroPoster} alt="" fill priority sizes="100vw" className="object-cover" />
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&mute=1&loop=1&playlist=${youtubeId}&controls=0&rel=0&playsinline=1&modestbranding=1&iv_load_policy=3&disablekb=1&fs=0`}
                title="Sfeervideo Honeymoon shop"
                allow="autoplay; encrypted-media; picture-in-picture"
                tabIndex={-1}
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 top-1/2 h-[max(56.25vw,100svh)] w-[max(100vw,177.78svh)] -translate-x-1/2 -translate-y-1/2 scale-[1.15] border-0"
              />
            </>
          ) : home.heroVideo ? (
            <video className="h-full w-full object-cover" autoPlay muted loop playsInline poster={home.heroPoster} aria-hidden="true">
              <source src={home.heroVideo} type={home.heroVideo.endsWith(".webm") ? "video/webm" : "video/mp4"} />
            </video>
          ) : (
            slides.map((src, i) => (
              <div key={src} className={`absolute inset-0 ${slides.length > 1 ? "hero-slide" : ""}`} style={slides.length > 1 ? { animationDelay: `${i * 6 - 1.5}s, ${i * 6 - 1.5}s` } : undefined}>
                <Image src={src} alt="" fill priority={i === 0} sizes="100vw" className="object-cover" />
              </div>
            ))
          )}
        </div>
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ink/90 via-ink/30 to-ink/40" />
        <div className="container-x pb-16 pt-40 sm:pb-24">
          <p className="eyebrow text-lilac">{home.heroEyebrow}</p>
          <h1 className="mt-5 max-w-5xl text-[3.4rem] leading-[0.95] text-white sm:text-7xl lg:text-[7.5rem]">
            {home.heroTitle.split(/(happiness)/i).map((part, i) => (/happiness/i.test(part) ? <em key={i} className="text-lilac">{part}</em> : part))}
          </h1>
          <p className="mt-6 max-w-xl text-lg text-white/85 sm:text-xl">{home.heroText}</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/afspraak-maken/" className="btn-white">
              <Icon name="calendar" className="h-4 w-4" /> Plan je pasafspraak
            </Link>
            <Link href="/trouwjurken/" className="btn border border-white/60 text-white hover:bg-white hover:text-ink">
              Bekijk de collectie
            </Link>
          </div>
          <dl className="mt-14 hidden max-w-3xl grid-cols-4 gap-8 border-t border-white/20 pt-6 sm:grid">
            {[
              ["5", "verdiepingen bruidsmode"],
              [String(dressCount), "trouwjurken online"],
              [site.googleRating.score, `op Google (${site.googleRating.count})`],
              ["#1", "trouwpakkenwinkel 2025"],
            ].map(([n, l]) => (
              <div key={l}>
                <dt className="sr-only">{l}</dt>
                <dd>
                  <span className="block font-serif text-4xl text-white">{n}</span>
                  <span className="text-sm text-white/70">{l}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* 2. Bruid of bruidegom */}
      <section className="container-x grid gap-4 py-4 sm:gap-6 sm:py-6 md:grid-cols-2" aria-label="Kies je collectie">
        {[
          { href: "/trouwjurk-en-accessoires/", image: home.brideImage, top: "Alles voor", bottom: "de bruid.", label: "Voor haar", tone: "bg-lilac text-ink", alt: "Bruid in een zeemeermin-trouwjurk met kanten sleep" },
          { href: "/bruidegom/", image: home.groomImage, top: "Alles voor", bottom: "de bruidegom.", label: "Voor hem", tone: "bg-petrol text-white", alt: "Twee bruidegoms in een blauw en een groen trouwpak" },
        ].map((t) => (
          <Link key={t.href} href={t.href} className="group relative isolate block aspect-[4/5] overflow-hidden rounded-[1.75rem] rounded-tr-[6rem] sm:aspect-[5/6] lg:aspect-[4/4.2]">
            <Image src={t.image} alt={t.alt} fill sizes="(max-width: 768px) 100vw, 50vw" className="-z-10 object-cover transition duration-[1.2s] ease-[var(--ease-soft)] group-hover:scale-105" />
            <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ink/75 via-transparent to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6 sm:p-10">
              <p className="font-serif text-5xl font-light leading-[0.95] text-white sm:text-6xl lg:text-7xl">
                {t.top}
                <br />
                <strong className="font-semibold">{t.bottom}</strong>
              </p>
              <span className={`mt-6 inline-flex items-center gap-3 rounded-full px-7 py-3.5 font-serif text-2xl italic transition group-hover:gap-5 ${t.tone}`}>
                {t.label} <Icon name="arrow" className="h-5 w-5" />
              </span>
            </div>
          </Link>
        ))}
      </section>

      <Marquee items={["5 verdiepingen bruidsmode", "#1 trouwpakkenwinkel van 2025", "Eigen atelier", "CBW-erkend", "Perfect Match: samen passen zonder elkaar te zien", "Plus size collectie"]} className="mt-10 text-ink" />

      {/* 3. Intro */}
      <section className="container-x grid gap-12 py-20 lg:grid-cols-12 lg:py-28">
        <div className="lg:col-span-5">
          <p className="eyebrow text-lilac-700">Over de Honeymoon shop</p>
          <h2 className="mt-4 text-5xl sm:text-6xl">
            Creating <em className="text-lilac-700">happiness</em> for the bride &amp; groom
          </h2>
        </div>
        <div className="lg:col-span-6 lg:col-start-7">
          <Html html={page?.html} className="text-lg" />
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/de-winkel/over-de-honeymoon-shop/" className="btn-ghost">
              Over onze winkel
            </Link>
            <Link href="/team/" className="btn-ghost">
              Ontmoet ons team
            </Link>
          </div>
        </div>
      </section>

      {/* 4. Collectie highlights */}
      <section className="bg-cream py-20 lg:py-28">
        <div className="container-x">
          <SectionHead
            eyebrow="Collectie 2027"
            title={
              <>
                Laat je <em>betoveren</em>
              </>
            }
            text="Van romantisch kant tot strak en modern: een greep uit onze trouwjurken. Bewaar je favorieten met het hartje en neem ze mee naar je pasafspraak."
            action={
              <Link href="/trouwjurken/" className="btn-primary">
                Alle {dressCount} trouwjurken <Icon name="arrow" className="h-4 w-4" />
              </Link>
            }
          />
          <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0">
            {dresses.slice(0, 8).map((p) => (
              <div key={p.id} className="w-[70vw] shrink-0 snap-start sm:w-[42vw] lg:w-auto">
                <ProductCard p={p} sizes="(max-width: 640px) 70vw, (max-width: 1024px) 42vw, 25vw" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Online passen */}
      <section className="container-x grid items-center gap-12 py-20 lg:grid-cols-2 lg:py-28">
        <div className="relative">
          <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] rounded-tr-[7rem]">
            <Image src="/uploads/helene_01-1779206892-1365x2048.webp" alt="Trouwjurk Helene van Jarice" fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
          </div>
          <div className="absolute -bottom-6 left-6 flex items-center gap-3 rounded-full bg-white px-5 py-3 shadow-xl sm:left-10">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-lilac text-xl">🙂</span>
            <span className="text-sm font-medium">Upload jezelf in elke jurk</span>
          </div>
        </div>
        <div>
          <p className="eyebrow text-lilac-700">Nieuw: online passen</p>
          <h2 className="mt-4 text-5xl sm:text-6xl">
            Zie jezelf alvast in <em>jouw</em> droomjurk
          </h2>
          <p className="mt-5 text-lg text-ink-soft">
            Bij elke trouwjurk en elk trouwpak vind je de knop <strong className="text-ink">Upload jezelf 🙂</strong>. Upload een foto van je gezicht en schuif jezelf in de jurk of het pak — je foto blijft gewoon op je eigen telefoon. Verliefd? Neem je favoriet mee naar je pasafspraak en ervaar hem in het echt.
          </p>
          <ul className="mt-6 space-y-3 text-ink-2">
            {["Werkt met een selfie of een foto van je hele lichaam", "Verschuiven, vergroten en draaien tot het klopt", "Bewaar je look en deel hem met je getuige"].map((t) => (
              <li key={t} className="flex gap-3">
                <Icon name="check" className="mt-1 h-5 w-5 text-lilac-700" /> {t}
              </li>
            ))}
          </ul>
          <Link href={dresses[0]?.path ?? "/trouwjurken/"} className="btn-primary mt-8">
            Probeer het bij een jurk <Icon name="arrow" className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* 6. Afspraak maken */}
      <section className="on-dark bg-ink py-20 text-white lg:py-28">
        <div className="container-x">
          <SectionHead
            light
            eyebrow="Kom passen bij de Honeymoon shop"
            title={
              <>
                Jullie <em>perfect match</em> begint hier
              </>
            }
            text="Samen passen zonder elkaar te zien? Of liever allebei op een eigen moment? Het kan allemaal. Kies je afspraak en plan hem direct online."
          />
          <div className="grid gap-6 md:grid-cols-3">
            {apptCards.map((c) =>
              c.type ? (
                <Link key={c.href} href={c.href} className="group relative isolate flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-[1.75rem] rounded-tr-[5rem] p-7">
                  <Image src={c.image} alt="" fill sizes="(max-width: 768px) 100vw, 33vw" className="-z-10 object-cover transition duration-700 group-hover:scale-105" />
                  <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ink via-ink/30 to-transparent" />
                  <p className="eyebrow text-lilac">{c.type.short}</p>
                  <h3 className="mt-2 text-4xl text-white">{c.type.label}</h3>
                  <p className="mt-2 text-white/80">{c.type.description}</p>
                  <span className="mt-5 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em]">
                    Kies een moment <Icon name="arrow" className="h-4 w-4 transition group-hover:translate-x-1" />
                  </span>
                </Link>
              ) : null,
            )}
          </div>
          <p className="mt-8 text-white/70">
            Liever bellen? We helpen je graag via{" "}
            <a href={`tel:${site.phoneIntl}`} className="text-white underline underline-offset-4">
              {site.phone}
            </a>
            .
          </p>
        </div>
      </section>

      {/* 7. Reviews */}
      {reviews.length > 0 && (
        <section className="bg-blush py-20 lg:py-28">
          <div className="container-x">
            <SectionHead
              eyebrow="Real Brides & Grooms"
              title={
                <>
                  Deze bruiden gingen <em>je voor</em>
                </>
              }
              action={
                <Link href="/real-brides/" className="btn-ghost">
                  Alle verhalen
                </Link>
              }
            />
            <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-6 sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0">
              {reviews.slice(0, 4).map((r) => (
                <div key={r.id} className="w-[80vw] shrink-0 snap-start sm:w-[45vw] lg:w-auto">
                  <ReviewCard r={r} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 8. Bruidegom */}
      <section className="on-dark bg-petrol py-20 text-white lg:py-28">
        <div className="container-x">
          <SectionHead
            light
            eyebrow="Honeymoon Men's shop"
            title={
              <>
                Welk pak past bij <em>jou</em>?
              </>
            }
            text="Uitgeroepen tot beste trouwpakkenwinkel van 2025. Van klassiek driedelig tot een maatpak in jouw kleur."
            action={
              <Link href="/pakken/" className="btn-white">
                Trouwpakken bekijken <Icon name="arrow" className="h-4 w-4" />
              </Link>
            }
          />
          <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0 [&_h3]:text-white [&_.eyebrow]:text-white/60 [&_p]:text-white/70">
            {suits.slice(0, 4).map((p) => (
              <div key={p.id} className="w-[70vw] shrink-0 snap-start sm:w-[42vw] lg:w-auto">
                <ProductCard p={p} sizes="(max-width: 640px) 70vw, (max-width: 1024px) 42vw, 25vw" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 9. Blog */}
      <section className="container-x py-20 lg:py-28">
        <SectionHead
          eyebrow="Inspiratie"
          title={
            <>
              Van <em>ja</em> tot jawoord
            </>
          }
          action={
            <Link href="/blog/" className="btn-ghost">
              Naar de blog
            </Link>
          }
        />
        <div className="grid gap-10 md:grid-cols-3">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      </section>

      {/* 10. FAQ */}
      {faqItems.length > 0 && (
        <section className="bg-cream py-20 lg:py-28">
          <div className="container-x grid gap-12 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <p className="eyebrow text-lilac-700">Goed om te weten</p>
              <h2 className="mt-4 text-5xl">Veelgestelde vragen</h2>
              <p className="mt-4 text-ink-soft">
                Staat je vraag er niet bij? Bekijk alle{" "}
                <Link href="/de-winkel/veelgestelde-vragen/" className="link">
                  veelgestelde vragen over trouwjurken en pasafspraken
                </Link>{" "}
                of{" "}
                <Link href="/contact/" className="link">
                  neem contact met ons op
                </Link>
                .
              </p>
            </div>
            <div className="lg:col-span-7 lg:col-start-6">
              <FaqList items={faqItems} />
            </div>
          </div>
        </section>
      )}

      <CtaBand />
      <JsonLd data={graph(storeLd(site), faqItems.length ? faqLd(faqItems) : null)} />
    </>
  );
}
