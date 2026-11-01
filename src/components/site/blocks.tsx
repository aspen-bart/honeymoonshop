import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import type { Faq } from "@/lib/json";
import { clip, formatDate, plain } from "@/lib/text";

export function SectionHead({ eyebrow, title, text, action, light = false, align = "left" }: { eyebrow?: string; title: React.ReactNode; text?: React.ReactNode; action?: React.ReactNode; light?: boolean; align?: "left" | "center" }) {
  return (
    <div className={`mb-10 flex flex-wrap items-end justify-between gap-6 ${align === "center" ? "flex-col items-center text-center" : ""}`}>
      <div className={align === "center" ? "max-w-2xl" : "max-w-2xl"}>
        {eyebrow && <p className={`eyebrow mb-3 ${light ? "text-lilac" : "text-lilac-700"}`}>{eyebrow}</p>}
        <h2 className={`text-4xl sm:text-5xl lg:text-6xl ${light ? "text-white" : ""}`}>{title}</h2>
        {text && <p className={`mt-4 text-lg ${light ? "text-white/80" : "text-ink-soft"}`}>{text}</p>}
      </div>
      {action}
    </div>
  );
}

export function Marquee({ items, className = "" }: { items: string[]; className?: string }) {
  const row = [...items, ...items];
  return (
    <div className={`marquee overflow-hidden border-y border-ink/10 py-5 ${className}`} aria-label={items.join(" · ")}>
      <div className="marquee-track flex w-max items-center gap-10 whitespace-nowrap" aria-hidden="true">
        {row.map((t, i) => (
          <span key={i} className="flex items-center gap-10 font-serif text-3xl italic sm:text-4xl">
            {t}
            <span className="text-lilac-500 not-italic">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export type PostCardData = { path: string; title: string; excerpt: string; heroImage: string | null; heroAlt: string; publishedAt: Date; category?: { name: string } | null };

export function PostCard({ post, large = false }: { post: PostCardData; large?: boolean }) {
  return (
    <article className="group">
      <Link href={post.path} className="block">
        <div className={`relative overflow-hidden rounded-tr-[3rem] bg-cream-2 ${large ? "aspect-[4/3]" : "aspect-[3/2]"}`}>
          {post.heroImage && <Image src={post.heroImage} alt={post.heroAlt || ""} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover transition duration-700 group-hover:scale-105" />}
        </div>
        <p className="eyebrow mt-4 text-ink-soft">
          {post.category?.name ?? "Blog"} · <time dateTime={post.publishedAt.toISOString()}>{formatDate(post.publishedAt)}</time>
        </p>
        <h3 className={`mt-2 leading-tight transition group-hover:text-lilac-700 ${large ? "text-3xl" : "text-2xl"}`}>{post.title}</h3>
        {post.excerpt && <p className="mt-2 text-[0.95rem] text-ink-soft">{clip(post.excerpt, 140)}</p>}
      </Link>
    </article>
  );
}

export type ReviewCardData = { path: string; name: string; html: string; image: string | null; publishedAt: Date };

export function ReviewCard({ r }: { r: ReviewCardData }) {
  const text = clip(plain(r.html), 210);
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-[1.75rem] rounded-tr-[4rem] bg-white shadow-[0_20px_50px_-30px_rgba(43,40,67,0.4)]">
      <Link href={r.path} className="flex h-full flex-col">
        <div className="relative aspect-[4/3] overflow-hidden bg-cream-2">
          {r.image && <Image src={r.image} alt={`Real bride ${r.name}`} fill sizes="(max-width: 768px) 85vw, 25vw" className="object-cover transition duration-700 group-hover:scale-105" />}
        </div>
        <div className="flex flex-1 flex-col p-6">
          <span className="font-serif text-5xl leading-none text-lilac-500" aria-hidden="true">“</span>
          {text && <p className="flex-1 text-[0.95rem] leading-relaxed text-ink-2">{text}</p>}
          <p className="mt-4 font-serif text-2xl">{r.name}</p>
          <span className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.16em] text-lilac-700">
            Lees het verhaal van {r.name.split(/[&+]/)[0].trim()} <Icon name="arrow" className="h-3.5 w-3.5" />
          </span>
        </div>
      </Link>
    </article>
  );
}

export function FaqList({ items }: { items: Faq[] }) {
  return (
    <div className="prose-hms">
      {items.map((f) => (
        <details key={f.q}>
          <summary>{f.q}</summary>
          <p className="pb-4">{f.a}</p>
        </details>
      ))}
    </div>
  );
}

/** Afsluitende vervolgstap onder elke pagina: afspraak maken (het doel van de site) of contact. */
export function CtaBand({ title = "Klaar om jouw look te vinden?", text = "Plan je pasafspraak: een eigen styliste, alle tijd en een glas bubbels als je ‘ja’ zegt.", primary = { href: "/afspraak-maken/", label: "Maak een pasafspraak" }, secondary = { href: "/contact/", label: "Stel je vraag" } }: { title?: string; text?: string; primary?: { href: string; label: string }; secondary?: { href: string; label: string } | null }) {
  return (
    <section className="on-dark relative overflow-hidden bg-lilac-700 text-white">
      <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-lilac-500/40 blur-3xl" />
      <div className="container-x relative flex flex-col items-start gap-8 py-16 lg:flex-row lg:items-center lg:justify-between lg:py-20">
        <div className="max-w-2xl">
          <h2 className="text-4xl text-white sm:text-5xl">{title}</h2>
          <p className="mt-3 text-lg text-white/85">{text}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href={primary.href} className="btn-white">
            <Icon name="calendar" className="h-4 w-4" /> {primary.label}
          </Link>
          {secondary && (
            <Link href={secondary.href} className="btn border border-white/60 text-white hover:bg-white hover:text-ink">
              {secondary.label}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

/** Kop van een gewone pagina: kruimelpad, H1 en optioneel een beeld. */
export function PageHero({ title, intro, image, imageAlt = "", crumbs, eyebrow }: { title: string; intro?: React.ReactNode; image?: string | null; imageAlt?: string; crumbs: React.ReactNode; eyebrow?: string }) {
  if (image) {
    return (
      <section className="on-dark relative isolate flex min-h-[52vh] items-end overflow-hidden bg-ink text-white">
        <Image src={image} alt={imageAlt} fill priority sizes="100vw" className="-z-10 object-cover opacity-80" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ink via-ink/40 to-ink/10" />
        <div className="container-x pb-12 pt-28">
          {crumbs}
          {eyebrow && <p className="eyebrow mt-6 text-lilac">{eyebrow}</p>}
          <h1 className="mt-4 max-w-4xl text-5xl text-white sm:text-6xl lg:text-7xl">{title}</h1>
          {intro && <div className="mt-4 max-w-2xl text-lg text-white/85">{intro}</div>}
        </div>
      </section>
    );
  }
  return (
    <section className="bg-cream">
      <div className="container-x pb-10 pt-10 lg:pb-14">
        {crumbs}
        {eyebrow && <p className="eyebrow mt-8 text-lilac-700">{eyebrow}</p>}
        <h1 className="mt-4 max-w-4xl text-5xl sm:text-6xl lg:text-7xl">{title}</h1>
        {intro && <div className="mt-4 max-w-2xl text-lg text-ink-soft">{intro}</div>}
      </div>
    </section>
  );
}
