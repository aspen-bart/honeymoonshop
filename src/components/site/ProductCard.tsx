import Image from "next/image";
import Link from "next/link";
import { images } from "@/lib/json";
import { euro } from "@/lib/text";
import { FavoriteButton } from "./FavoriteButton";

export type CardProduct = { path: string; name: string; kind: string; images: string; priceText: string | null; price: number | null; sale: boolean; brand?: { name: string } | null };

/** Productkaart met tweede foto (achterkant) bij hover, favorietenhartje en prijsindicatie. */
export function ProductCard({ p, priority = false, sizes = "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" }: { p: CardProduct; priority?: boolean; sizes?: string }) {
  const imgs = images(p.images);
  const [a, b] = imgs;
  return (
    <article className="group relative">
      <Link href={p.path} className="block">
        <div className="relative aspect-[3/4] overflow-hidden rounded-tr-[3.5rem] bg-cream-2">
          {a && <Image src={a.src} alt={a.alt || p.name} fill sizes={sizes} priority={priority} className={`object-cover transition duration-700 ease-[var(--ease-soft)] group-hover:scale-[1.04] ${b ? "group-hover:opacity-0" : ""}`} />}
          {b && <Image src={b.src} alt="" fill sizes={sizes} className="object-cover opacity-0 transition duration-700 group-hover:opacity-100" />}
          {p.sale && <span className="absolute left-3 top-3 rounded-full bg-ink px-3 py-1 text-[0.7rem] font-medium uppercase tracking-[0.16em] text-white">Sale</span>}
        </div>
        <div className="mt-3 pr-10">
          {p.brand && <p className="eyebrow text-ink-soft">{p.brand.name}</p>}
          <h3 className="mt-1 font-serif text-xl leading-tight transition group-hover:text-lilac-700">{p.name}</h3>
          {(p.priceText || p.price != null) && <p className="mt-1 text-sm text-ink-soft">{p.price != null ? euro(p.price) : `Prijsindicatie ${p.priceText!.replace(/^€?/, "€").replace(/ - (\d)/, " – €$1")}`}</p>}
        </div>
      </Link>
      <FavoriteButton item={{ path: p.path, name: p.name, image: a?.src ?? null, kind: p.kind }} iconClassName="h-6 w-6" className="absolute right-3 top-3 grid h-11 w-11 place-items-center rounded-full bg-white/90 text-ink shadow-sm hover:bg-lilac" />
    </article>
  );
}
