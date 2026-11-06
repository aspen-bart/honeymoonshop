"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { Logo } from "@/components/site/Logo";

type Item = { href: string; label: string; icon: IconName; min?: "editor" | "admin"; badge?: number; exact?: boolean };

export function AdminNav({ user, counts, logout }: { user: { name: string; roleName: string; role: string }; counts: { appointments: number; messages: number; reviews: number; tickets: number }; logout: () => Promise<void> }) {
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  const groups: { title: string; items: Item[] }[] = [
    { title: "", items: [{ href: "/admin/", label: "Dashboard", icon: "sliders" }] },
    {
      title: "Aanvragen",
      items: [
        { href: "/admin/afspraken/", label: "Afspraken", icon: "calendar", badge: counts.appointments },
        { href: "/admin/berichten/", label: "Berichten", icon: "mail", badge: counts.messages },
        { href: "/admin/formulieren/", label: "Formulieren", icon: "check", min: "admin" },
      ],
    },
    {
      title: "Shop",
      items: [
        { href: "/admin/shop/", label: "Overzicht", icon: "bag", exact: true },
        { href: "/admin/shop/producten/", label: "Producten", icon: "heart" },
        { href: "/admin/shop/prijzen/", label: "Prijzen", icon: "star" },
        { href: "/admin/shop/categorieen/", label: "Categorieën", icon: "filter" },
        { href: "/admin/shop/specificaties/", label: "Specificaties", icon: "scissors" },
        { href: "/admin/shop/merken/", label: "Merken", icon: "sparkle" },
      ],
    },
    {
      title: "Content",
      items: [
        { href: "/admin/paginas/", label: "Pagina's", icon: "info" },
        { href: "/admin/blogs/", label: "Blogs", icon: "sparkle" },
        { href: "/admin/reviews/", label: "Reviews", icon: "heart", badge: counts.reviews },
        { href: "/admin/media/", label: "Media", icon: "camera" },
      ],
    },
    {
      title: "SEO",
      items: [
        { href: "/admin/seo/", label: "SEO-overzicht", icon: "search" },
        { href: "/admin/redirects/", label: "Redirects", icon: "arrow", min: "editor" },
      ],
    },
    {
      title: "Beheer",
      items: [
        { href: "/admin/tickets/", label: "Tickets", icon: "mail", badge: counts.tickets },
        { href: "/admin/connecties/", label: "Connecties", icon: "rotate", min: "admin" },
        { href: "/admin/import-export/", label: "Import / export", icon: "download", min: "editor" },
        { href: "/admin/gebruikers/", label: "Gebruikers", icon: "users", min: "admin" },
        { href: "/admin/instellingen/", label: "Instellingen", icon: "sun", min: "admin" },
        { href: "/admin/logboek/", label: "Logboek", icon: "clock" },
      ],
    },
  ];
  const rank = { viewer: 1, editor: 2, admin: 3 } as Record<string, number>;
  const active = (i: Item) => (i.href === "/admin/" || i.exact ? pathname === i.href : pathname.startsWith(i.href));

  const nav = (
    <nav aria-label="Beheermenu" className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
      {groups.map((g) => (
        <div key={g.title || "main"}>
          {g.title && <p className="mb-1 px-3 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-white/40">{g.title}</p>}
          <ul className="space-y-0.5">
            {g.items
              .filter((i) => !i.min || rank[user.role] >= rank[i.min])
              .map((i) => (
                <li key={i.href}>
                  <Link href={i.href} aria-current={active(i) ? "page" : undefined} className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${active(i) ? "bg-white text-ink" : "text-white/80 hover:bg-white/10 hover:text-white"}`}>
                    <Icon name={i.icon} className="h-4.5 w-4.5" />
                    <span className="flex-1">{i.label}</span>
                    {!!i.badge && <span className="rounded-full bg-lilac px-2 text-xs font-semibold text-ink">{i.badge}</span>}
                  </Link>
                </li>
              ))}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <>
      <div className="sticky top-0 z-40 flex h-14 items-center justify-between bg-ink px-4 text-white lg:hidden">
        <Logo className="h-3 w-auto" />
        <button type="button" onClick={() => setOpen(true)} aria-expanded={open} aria-controls="admin-sidebar" className="rounded-lg p-2" aria-label="Menu openen">
          <Icon name="menu" />
        </button>
      </div>
      {open && <div className="fixed inset-0 z-40 bg-ink/50 lg:hidden" onClick={() => setOpen(false)} />}
      <aside id="admin-sidebar" className={`on-dark fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-ink text-white transition-transform lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-16 items-center justify-between px-6">
          <Link href="/admin/" aria-label="Dashboard">
            <Logo className="h-3 w-auto" />
          </Link>
          <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1 lg:hidden" aria-label="Menu sluiten">
            <Icon name="close" />
          </button>
        </div>
        {nav}
        <div className="border-t border-white/10 p-4 text-sm">
          <p className="font-medium">{user.name}</p>
          <p className="text-xs text-white/60">{user.roleName}</p>
          <div className="mt-3 flex gap-2">
            <Link href="/" target="_blank" className="rounded-full border border-white/20 px-3 py-1 text-xs hover:bg-white/10">
              Bekijk site
            </Link>
            <form action={logout}>
              <button className="rounded-full border border-white/20 px-3 py-1 text-xs hover:bg-white/10">Uitloggen</button>
            </form>
          </div>
        </div>
      </aside>
    </>
  );
}
