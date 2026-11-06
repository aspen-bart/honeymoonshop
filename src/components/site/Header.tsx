"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { MAIN_MENU, type MenuItem } from "@/lib/menu";
import { useFavorites } from "./favorites";
import { Logo } from "./Logo";

type Props = { phone: string; phoneIntl: string; topbar: string; rating: { score: string; count: number; url: string } };

function isActive(item: MenuItem, pathname: string) {
  if (pathname === item.href) return true;
  return item.columns.some((c) => c.links.some((l) => l.href !== "/" && pathname.startsWith(l.href)));
}

export function Header({ phone, phoneIntl, topbar, rating }: Props) {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState<number | null>(null);
  const [mobile, setMobile] = useState(false);
  const [mobileSub, setMobileSub] = useState<number | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const fav = useFavorites();
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHome = pathname === "/";

  useEffect(() => {
    setOpen(null);
    setMobile(false);
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(null);
        setMobile(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobile ? "hidden" : "";
  }, [mobile]);

  const transparent = isHome && !scrolled && open === null && !mobile;
  const enter = (i: number) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(i);
  };
  const leave = () => {
    closeTimer.current = setTimeout(() => setOpen(null), 160);
  };

  return (
    <>
      <div className="relative z-50 bg-lilac text-ink">
        <div className="container-x flex h-9 items-center justify-between gap-4 text-[0.78rem]">
          <Link href="/afspraak-maken/" className="inline-flex items-center gap-2 font-medium uppercase tracking-[0.16em] hover:underline">
            <Icon name="calendar" className="h-4 w-4" />
            {topbar}
          </Link>
          <div className="hidden items-center gap-6 sm:flex">
            <Link href="/beste-trouwpakkenwinkel-van-2025/" className="hover:underline">
              #1 Trouwpakkenwinkel van 2025
            </Link>
            <a href={rating.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline">
              <Icon name="star" className="h-3.5 w-3.5 fill-current" /> {rating.score} op Google ({rating.count} reviews)
              <span className="sr-only">(opent in een nieuw tabblad)</span>
            </a>
          </div>
        </div>
      </div>

      <header
        className={`sticky top-0 z-40 transition-colors duration-300 ${transparent ? "on-dark text-white" : "border-b border-line/70 bg-white/95 text-ink backdrop-blur"} ${isHome ? "-mb-[76px] lg:-mb-[84px]" : ""}`}
        onMouseLeave={leave}
      >
        <div className="container-x flex h-[76px] items-center gap-3 sm:gap-6 lg:h-[84px]">
          <Link href="/" className="shrink-0" aria-label="Honeymoon shop — naar de homepage">
            <Logo className="h-[12px] w-auto min-[400px]:h-[14px] sm:h-[19px] xl:h-[17px] 2xl:h-[22px]" />
          </Link>

          <nav aria-label="Hoofdmenu" className="ml-auto hidden xl:block">
            <ul className="flex items-center gap-1">
              {MAIN_MENU.map((item, i) => {
                const active = isActive(item, pathname);
                return (
                  <li key={item.label} onMouseEnter={() => enter(i)}>
                    <div className="flex items-center">
                      <Link
                        href={item.href}
                        aria-current={pathname === item.href ? "page" : undefined}
                        className={`relative whitespace-nowrap px-2 py-2 text-[0.78rem] font-medium uppercase tracking-[0.12em] 2xl:px-3 2xl:text-[0.82rem] 2xl:tracking-[0.16em] after:absolute after:inset-x-3 after:-bottom-0.5 after:h-0.5 after:origin-left after:scale-x-0 after:bg-current after:transition hover:after:scale-x-100 ${active ? "after:scale-x-100" : ""}`}
                      >
                        {item.label}
                      </Link>
                      <button
                        type="button"
                        className="-ml-2 rounded p-1"
                        aria-expanded={open === i}
                        aria-controls={`mega-${i}`}
                        aria-label={`Submenu ${item.label}`}
                        onClick={() => setOpen(open === i ? null : i)}
                      >
                        <Icon name="chevron" className={`h-3.5 w-3.5 transition ${open === i ? "rotate-180" : ""}`} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="ml-auto flex items-center gap-1 xl:ml-2">
            <a href={`tel:${phoneIntl}`} className="hidden rounded-full p-2.5 hover:bg-black/5 sm:inline-flex" aria-label={`Bel ons: ${phone}`}>
              <Icon name="phone" />
            </a>
            <Link href="/zoeken/" className="rounded-full p-2 hover:bg-black/5 sm:p-2.5" aria-label="Zoeken">
              <Icon name="search" />
            </Link>
            <Link href="/favorieten/" className="relative rounded-full p-2 hover:bg-black/5 sm:p-2.5" aria-label={`Favorieten (${fav.list.length})`}>
              <Icon name="heart" />
              {fav.list.length > 0 && (
                <span className="absolute right-0.5 top-0.5 grid h-4.5 min-w-4.5 place-items-center rounded-full bg-lilac-700 px-1 text-[0.65rem] font-semibold text-white">{fav.list.length}</span>
              )}
            </Link>
            <Link href="/afspraak-maken/" className={`ml-2 hidden sm:inline-flex ${transparent ? "btn-white" : "btn-primary"} whitespace-nowrap !px-5 !py-3 !text-[0.75rem]`}>
              Afspraak maken
            </Link>
            <button type="button" className="rounded-full p-2 hover:bg-black/5 sm:ml-1 sm:p-2.5 xl:hidden" aria-expanded={mobile} aria-controls="mobile-menu" aria-label="Menu openen" onClick={() => setMobile(true)}>
              <Icon name="menu" className="h-6 w-6" />
            </button>
          </div>
        </div>

        {MAIN_MENU.map((item, i) => (
          <div
            key={item.label}
            id={`mega-${i}`}
            hidden={open !== i}
            onMouseEnter={() => enter(i)}
            className="absolute inset-x-0 top-full hidden border-t border-line bg-white text-ink shadow-[0_30px_60px_-30px_rgba(43,40,67,0.35)] xl:block"
          >
            <div className="container-x grid grid-cols-12 gap-10 py-10">
              <div className={`grid gap-8 ${item.feature ? "col-span-8 grid-cols-3" : "col-span-12 grid-cols-4"}`}>
                {item.columns.map((col) => (
                  <div key={col.title}>
                    <p className="eyebrow mb-4 text-ink-soft">{col.title}</p>
                    <ul className="space-y-2.5">
                      {col.links.map((l) => (
                        <li key={l.href}>
                          <Link href={l.href} aria-current={pathname === l.href ? "page" : undefined} className={`font-serif text-xl transition hover:text-lilac-700 ${pathname === l.href ? "text-lilac-700" : ""}`}>
                            {l.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              {item.feature && (
                <Link href={item.feature.href} className="group relative col-span-4 block overflow-hidden signature">
                  <Image src={item.feature.image} alt="" width={520} height={340} className="h-64 w-full object-cover transition duration-700 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/10 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-6 text-white">
                    <p className="font-serif text-3xl">{item.feature.title}</p>
                    <p className="mt-1 text-sm text-white/85">{item.feature.text}</p>
                    <span className="mt-3 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em]">
                      {item.feature.cta} <Icon name="arrow" className="h-4 w-4 transition group-hover:translate-x-1" />
                    </span>
                  </div>
                </Link>
              )}
            </div>
          </div>
        ))}
      </header>

      {/* Mobiel menu */}
      <div id="mobile-menu" className={`fixed inset-0 z-[60] xl:hidden ${mobile ? "" : "pointer-events-none"}`} aria-hidden={!mobile} inert={!mobile}>
        <div className={`absolute inset-0 bg-ink/50 transition-opacity ${mobile ? "opacity-100" : "opacity-0"}`} onClick={() => setMobile(false)} />
        <nav aria-label="Mobiel menu" className={`absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white text-ink transition-transform duration-500 ease-[var(--ease-soft)] ${mobile ? "translate-x-0" : "translate-x-full"}`}>
          <div className="flex h-[76px] items-center justify-between border-b border-line px-5">
            <Logo className="h-[15px] w-auto" />
            <button type="button" className="rounded-full p-2.5 hover:bg-black/5" onClick={() => setMobile(false)} aria-label="Menu sluiten">
              <Icon name="close" className="h-6 w-6" />
            </button>
          </div>
          <ul className="flex-1 overflow-y-auto px-5 py-4">
            {MAIN_MENU.map((item, i) => (
              <li key={item.label} className="border-b border-line">
                <div className="flex items-center justify-between">
                  <Link href={item.href} className={`py-4 font-serif text-3xl ${isActive(item, pathname) ? "text-lilac-700" : ""}`}>
                    {item.label}
                  </Link>
                  <button type="button" className="rounded-full p-3" aria-expanded={mobileSub === i} aria-label={`Submenu ${item.label}`} onClick={() => setMobileSub(mobileSub === i ? null : i)}>
                    <Icon name="chevron" className={`h-5 w-5 transition ${mobileSub === i ? "rotate-180" : ""}`} />
                  </button>
                </div>
                <div hidden={mobileSub !== i} className="pb-5">
                  {item.columns.map((col) => (
                    <div key={col.title} className="mt-3">
                      <p className="eyebrow mb-2 text-ink-soft">{col.title}</p>
                      <ul className="grid grid-cols-2 gap-x-4 gap-y-2">
                        {col.links.map((l) => (
                          <li key={l.href}>
                            <Link href={l.href} aria-current={pathname === l.href ? "page" : undefined} className={`text-[0.95rem] ${pathname === l.href ? "font-semibold text-lilac-700" : ""}`}>
                              {l.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
          <div className="grid gap-3 border-t border-line p-5">
            <Link href="/afspraak-maken/" className="btn-primary w-full">
              <Icon name="calendar" className="h-4 w-4" /> Afspraak maken
            </Link>
            <a href={`tel:${phoneIntl}`} className="btn-ghost w-full">
              <Icon name="phone" className="h-4 w-4" /> {phone}
            </a>
          </div>
        </nav>
      </div>
    </>
  );
}
