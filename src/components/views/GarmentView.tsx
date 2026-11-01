import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { DragRail } from "@/components/site/DragRail";
import { CtaBand, ReviewCard, SectionHead } from "@/components/site/blocks";
import { FavoriteButton } from "@/components/site/FavoriteButton";
import { Gallery } from "@/components/site/Gallery";
import { Html } from "@/components/site/Html";
import { JsonLd } from "@/components/site/JsonLd";
import { ProductCard } from "@/components/site/ProductCard";
import { TryOnButton } from "@/components/site/TryOn";
import { FILTERS, featuredReviews, relatedGarments, type ProductFull } from "@/lib/content";
import { aiTryOnAvailable } from "@/lib/ai";
import { attributes, images, parse, type TryOnSpot } from "@/lib/json";
import { breadcrumbLd, describe, graph, productLd, type Crumb } from "@/lib/seo";
import { getSite } from "@/lib/settings";

export async function GarmentView({ product }: { product: ProductFull }) {
  const isDress = product.kind === "dress";
  const base = isDress ? { name: "Trouwjurken", path: "/trouwjurken/" } : { name: "Trouwpakken", path: "/pakken/" };
  const crumbs: Crumb[] = [base, { name: product.name, path: product.path }];
  const imgs = images(product.images);
  const attrs = attributes(product.attributes);
  const [related, reviews, site, ai] = await Promise.all([relatedGarments(product, 10), featuredReviews(3), getSite(), aiTryOnAvailable()]);
  const apptHref = `/afspraak-maken/${isDress ? "trouwjurk-passen" : "trouwpak-passen"}/?product=${encodeURIComponent(product.path)}`;
  const groups = FILTERS[product.kind as "dress" | "suit"];
  const slugFor = (group: string, value: string) => groups.find((g) => g.name === group)?.terms.find((t) => t.name === value)?.slug;
  const label = isDress ? "jurk" : "pak";
  const shownAttrs = Object.entries(attrs).filter(([g]) => g !== "Prijs" && g !== "Merk" && g !== "Merken");

  return (
    <>
      <div className="container-x pt-6">
        <Breadcrumbs items={crumbs} />
      </div>
      <section className="container-x grid gap-10 py-8 lg:grid-cols-[1.15fr_1fr] lg:gap-16 lg:py-10">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <Gallery images={imgs} name={product.name} />
        </div>
        <div>
          <div className="flex items-start justify-between gap-4">
            <div>
              {product.brand && (
                <Link href={`${base.path}${product.brand.slug}/`} className="eyebrow text-lilac-700 hover:underline">
                  {product.brand.name}
                </Link>
              )}
              <h1 className="mt-3 text-5xl sm:text-6xl">{product.name}</h1>
              {product.articleNumber && <p className="mt-2 text-sm text-ink-soft">Artikelnummer {product.articleNumber}</p>}
            </div>
            {product.brand?.logo && <Image src={product.brand.logo} alt={`Logo ${product.brand.name}`} width={150} height={42} className="mt-2 h-auto w-28 opacity-80" />}
          </div>

          <Html html={product.descriptionHtml} className="mt-6" />

          {product.priceText && (
            <div className="mt-6 flex items-center justify-between gap-4 rounded-2xl bg-cream px-5 py-4">
              <div>
                <p className="text-sm text-ink-soft">Prijsindicatie</p>
                <p className="font-serif text-3xl">{product.priceText.replace(/(\d+)\s*-\s*€?(\d+)/, "€$1 – €$2").replace(/^€€/, "€")}</p>
              </div>
              {product.sale && <span className="rounded-full bg-ink px-3 py-1 text-xs uppercase tracking-[0.16em] text-white">Sale</span>}
            </div>
          )}

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Link href={apptHref} className="btn-primary sm:col-span-2">
              <Icon name="calendar" className="h-4 w-4" /> Pasafspraak maken
            </Link>
            <TryOnButton
              productName={product.name}
              productPath={product.path}
              kind={product.kind}
              images={imgs}
              spot={parse<TryOnSpot | null>(product.tryOn, null)}
              appointmentHref={apptHref}
              aiAvailable={ai}
              className="btn-lilac w-full"
            />
            <FavoriteButton item={{ path: product.path, name: product.name, image: imgs[0]?.src ?? null, kind: product.kind }} withLabel className="btn-ghost w-full justify-center" />
          </div>
          <Link href={`/contact/?over=${encodeURIComponent(product.path)}`} className="mt-4 inline-flex items-center gap-2 text-sm underline underline-offset-4">
            <Icon name="mail" className="h-4 w-4" /> Stel een vraag over {isDress ? "deze jurk" : "dit pak"}
          </Link>

          {shownAttrs.length > 0 && (
            <dl className="mt-8 divide-y divide-line border-y border-line">
              {shownAttrs.map(([group, values]) => (
                <div key={group} className="grid grid-cols-[130px_1fr] gap-4 py-3 text-[0.95rem]">
                  <dt className="text-ink-soft">{group}</dt>
                  <dd className="flex flex-wrap gap-x-3 gap-y-1">
                    {values.map((v) => {
                      const slug = slugFor(group, v);
                      return slug ? (
                        <Link key={v} href={`${base.path}${slug}/`} className="link">
                          {v}
                        </Link>
                      ) : (
                        <span key={v}>{v}</span>
                      );
                    })}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {(isDress
              ? [
                  ["user", "Eigen styliste", "Alle tijd en persoonlijk advies tijdens je pasafspraak."],
                  ["scissors", "Eigen atelier", "Vermaken op maat door onze coupeuses."],
                  ["users", "Perfect Match", "Samen passen zonder elkaar te zien."],
                  ["heart", "10% op zijn pak", "Geslaagd voor je jurk? Dan krijgt hij 10% korting."],
                ]
              : [
                  ["user", "Persoonlijk advies", "Onze Men's shop-stylisten helpen je aan de juiste pasvorm."],
                  ["scissors", "Op maat vermaakt", "Mouwen en pijpen perfect op lengte."],
                  ["star", "Award 2025", "Uitgeroepen tot beste trouwpakkenwinkel."],
                  ["users", "Perfect Match", "Pak en jurk die bij elkaar passen."],
                ]
            ).map(([icon, t, d]) => (
              <li key={t} className="flex gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-lilac-100 text-lilac-700">
                  <Icon name={icon as "user"} className="h-5 w-5" />
                </span>
                <span>
                  <strong className="block font-medium">{t}</strong>
                  <span className="text-sm text-ink-soft">{d}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-sm text-ink-soft">
            Lees ook{" "}
            <Link href={isDress ? "/de-winkel/eerste-pasafspraak/" : "/bruidegom/maatpak/"} className="link">
              {isDress ? "hoe je eerste pasafspraak verloopt" : "alles over een maatpak voor je bruiloft"}
            </Link>{" "}
            of bekijk de{" "}
            <Link href={isDress ? "/silhouetten-voor-je-trouwjurk/" : "/perfect-match/"} className="link">
              {isDress ? "gids met silhouetten voor je trouwjurk" : "Perfect Match voor bruid en bruidegom"}
            </Link>
            .
          </p>
        </div>
      </section>

      {related.length > 0 && (
        <section className="bg-cream py-16 lg:py-20">
          <div className="container-x">
            <SectionHead
              eyebrow="Misschien ook iets voor jou"
              title={isDress ? "Bekijk ook deze trouwjurken" : "Bekijk ook eens deze mooie trouwpakken"}
              action={
                <Link href={base.path} className="btn-ghost">
                  Alle {base.name.toLowerCase()}
                </Link>
              }
            />
            {/* 3,5 kaart zichtbaar (desktop), 2,5 op tablet, 1,5 op mobiel: de halve kaart nodigt uit om te swipen */}
            <DragRail label={isDress ? "Meer trouwjurken" : "Meer trouwpakken"}>
              {related.map((p) => (
                <div key={p.id} className="w-[calc((100%-20px)/1.5)] shrink-0 snap-start sm:w-[calc((100%-40px)/2.5)] md:w-[calc((100%-60px)/3.5)]">
                  <ProductCard p={p} sizes="(max-width: 640px) 65vw, (max-width: 768px) 40vw, 28vw" />
                </div>
              ))}
            </DragRail>
          </div>
        </section>
      )}

      {reviews.length > 0 && (
        <section className="container-x py-16 lg:py-20">
          <SectionHead eyebrow={`${site.googleRating.score} op Google`} title="Wat bruidsparen zeggen" />
          <div className="grid gap-6 md:grid-cols-3">
            {reviews.map((r) => (
              <ReviewCard key={r.id} r={r} />
            ))}
          </div>
        </section>
      )}

      <CtaBand title={`Verliefd op dit ${label}?`} text="Kom hem passen: plan je afspraak en we zetten hem alvast voor je klaar." primary={{ href: apptHref, label: "Plan je pasafspraak" }} />
      <JsonLd
        data={graph(
          productLd({
            name: product.name,
            path: product.path,
            description: describe(product.metaDescription, product.descriptionHtml),
            images: imgs.map((i) => i.src),
            sku: product.articleNumber,
            brand: product.brand?.name,
            priceMin: product.priceMin,
            priceMax: product.priceMax,
            category: isDress ? "Trouwjurken" : "Trouwpakken",
          }),
          breadcrumbLd(crumbs),
        )}
      />
    </>
  );
}
