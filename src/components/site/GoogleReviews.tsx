import { Icon } from "@/components/Icon";
import { getSite } from "@/lib/settings";
import reviewsJson from "../../../content/google-reviews.json";
import { DragRail } from "./DragRail";

// Echte Google-reviews van de Honeymoon shop (overgenomen uit de Trustindex-widget van de oude site, zie
// scripts/google-reviews.mjs). Bewust geen aggregateRating in structured data: Google staat zelf-gepubliceerde
// reviews van een bedrijf niet toe als sterren in de zoekresultaten.
type GoogleReview = { name: string; stars: number; text: string };
const REVIEWS = reviewsJson as GoogleReview[];

const GOOGLE = "M21.35 11.1h-9.17v2.98h5.3c-.23 1.24-.93 2.3-1.98 3v2.5h3.2c1.87-1.73 2.95-4.27 2.95-7.28 0-.4-.03-.8-.1-1.2zM12.18 21.5c2.68 0 4.93-.89 6.57-2.42l-3.2-2.5c-.89.6-2.03.95-3.37.95-2.59 0-4.78-1.75-5.56-4.1H3.3v2.58A9.92 9.92 0 0 0 12.18 21.5zM6.62 13.43a5.97 5.97 0 0 1 0-3.86V7H3.3a9.93 9.93 0 0 0 0 8.99zM12.18 5.47c1.46 0 2.77.5 3.8 1.48l2.84-2.84A9.53 9.53 0 0 0 12.18 1.5 9.92 9.92 0 0 0 3.3 7l3.32 2.57c.78-2.35 2.97-4.1 5.56-4.1z";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

/** Reviews die over het juiste onderwerp gaan (pak/jurk) eerst. */
function ordered(focus?: "dress" | "suit") {
  if (!focus) return REVIEWS;
  const re = focus === "suit" ? /pak|kostuum|bruidegom|heren/i : /jurk|bruid/i;
  return [...REVIEWS].sort((a, b) => Number(re.test(b.text)) - Number(re.test(a.text)));
}

export async function GoogleReviews({ title = "Wat bruidsparen op Google zeggen", focus, tone = "cream" }: { title?: string; focus?: "dress" | "suit"; tone?: "cream" | "white" }) {
  if (!REVIEWS.length) return null;
  const site = await getSite();
  return (
    <section className={`${tone === "cream" ? "bg-cream" : "bg-white"} py-16 lg:py-20`} aria-labelledby="google-reviews-title">
      <div className="container-x">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="eyebrow flex items-center gap-2 text-lilac-700">
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                <path d={GOOGLE} fill="currentColor" />
              </svg>
              Google reviews
            </p>
            <h2 id="google-reviews-title" className="mt-3 text-4xl sm:text-5xl">
              {title}
            </h2>
          </div>
          <a href={site.googleRating.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 rounded-full border border-line bg-white px-5 py-3 transition hover:border-ink">
            <span className="font-serif text-4xl leading-none">{site.googleRating.score}</span>
            <span className="text-sm leading-tight">
              <span className="flex gap-0.5 text-gold" aria-hidden="true">
                {Array.from({ length: 5 }, (_, i) => (
                  <Icon key={i} name="star" className="h-4 w-4 fill-current" />
                ))}
              </span>
              <span className="text-ink-soft">{site.googleRating.count} beoordelingen op Google</span>
            </span>
            <span className="sr-only">(bekijk alle reviews op Google, opent in een nieuw tabblad)</span>
          </a>
        </div>
        <DragRail label="Google reviews">
          {ordered(focus).map((r) => (
            <figure key={r.name + r.text.slice(0, 20)} className="flex w-[calc((100%-20px)/1.15)] shrink-0 snap-start flex-col rounded-[1.5rem] rounded-tr-[3rem] border border-line bg-white p-6 sm:w-[calc((100%-40px)/2.2)] lg:w-[calc((100%-60px)/3.3)]">
              <div className="flex items-center justify-between">
                <span className="flex gap-0.5 text-gold" role="img" aria-label={`${r.stars} van 5 sterren`}>
                  {Array.from({ length: r.stars }, (_, i) => (
                    <Icon key={i} name="star" className="h-4 w-4 fill-current" />
                  ))}
                </span>
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-ink-soft" aria-label="Review op Google" role="img">
                  <path d={GOOGLE} fill="currentColor" />
                </svg>
              </div>
              <blockquote className="mt-4 flex-1 text-[0.95rem] leading-relaxed text-ink-2">
                <p className="line-clamp-6">{r.text}</p>
              </blockquote>
              <figcaption className="mt-5 flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-lilac text-sm font-semibold text-ink" aria-hidden="true">
                  {initials(r.name)}
                </span>
                <span className="text-sm font-medium">{r.name}</span>
              </figcaption>
            </figure>
          ))}
        </DragRail>
      </div>
    </section>
  );
}
