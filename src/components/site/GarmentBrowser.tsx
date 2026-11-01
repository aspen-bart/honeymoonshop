"use client";
import { useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import type { FilterGroup } from "@/lib/content";
import { ProductCard, type CardProduct } from "./ProductCard";

// Dressfinder: filteren, sorteren en "meer laden" in de browser. Alle kaarten staan al in de HTML-bron
// (verborgen kaarten met de class "hidden"), zodat zoekmachines elke jurk via deze pagina kunnen vinden.

export type BrowserItem = CardProduct & { id: string; attributes: Record<string, string[]>; priceMin: number | null; publishedAt: string };

const STEP = 24;

export function GarmentBrowser({ items, groups, initial, kindLabel }: { items: BrowserItem[]; groups: FilterGroup[]; initial?: { group: string; value: string } | null; kindLabel: string }) {
  const [selected, setSelected] = useState<Record<string, string[]>>(initial ? { [initial.group]: [initial.value] } : {});
  const [sort, setSort] = useState("standaard");
  const [limit, setLimit] = useState(STEP);
  const [open, setOpen] = useState(false);

  const usable = useMemo(
    () =>
      groups
        .map((g) => ({ ...g, terms: g.terms.filter((t) => items.some((i) => i.attributes[g.name]?.includes(t.name))) }))
        .filter((g) => g.terms.length > 0),
    [groups, items],
  );

  const matches = (item: BrowserItem, skip?: string) =>
    Object.entries(selected).every(([g, vals]) => g === skip || vals.length === 0 || vals.some((v) => item.attributes[g]?.includes(v)));

  const filtered = useMemo(() => {
    const list = items.filter((i) => matches(i));
    if (sort === "prijs-laag") list.sort((a, b) => (a.priceMin ?? 1e9) - (b.priceMin ?? 1e9));
    if (sort === "prijs-hoog") list.sort((a, b) => (b.priceMin ?? -1) - (a.priceMin ?? -1));
    if (sort === "nieuw") list.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, selected, sort]);

  const visible = new Set(filtered.slice(0, limit).map((i) => i.id));
  const order = new Map(filtered.map((i, idx) => [i.id, idx]));
  const active = Object.entries(selected).flatMap(([g, vals]) => vals.map((v) => ({ g, v })));

  const toggle = (g: string, v: string) => {
    setLimit(STEP);
    setSelected((s) => {
      const cur = s[g] ?? [];
      return { ...s, [g]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] };
    });
  };

  const facets = (
    <div className="space-y-2">
      {usable.map((g) => (
        <details key={g.name} className="group rounded-2xl border border-line bg-white" open={!!selected[g.name]?.length || g.name === usable[0]?.name}>
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 font-medium">
            {g.name}
            {!!selected[g.name]?.length && <span className="ml-auto mr-2 rounded-full bg-lilac px-2 text-xs">{selected[g.name].length}</span>}
            <Icon name="chevron" className="h-4 w-4 transition group-open:rotate-180" />
          </summary>
          <ul className="max-h-72 space-y-1 overflow-y-auto px-4 pb-4">
            {g.terms.map((t) => {
              const count = items.filter((i) => i.attributes[g.name]?.includes(t.name) && matches(i, g.name)).length;
              const checked = selected[g.name]?.includes(t.name) ?? false;
              return (
                <li key={t.slug}>
                  <label className={`flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-[0.95rem] hover:bg-cream ${count === 0 && !checked ? "opacity-40" : ""}`}>
                    <input type="checkbox" className="h-4 w-4 accent-[var(--color-lilac-700)]" checked={checked} onChange={() => toggle(g.name, t.name)} />
                    <span className="flex-1">{t.name}</span>
                    <span className="text-xs text-ink-soft">{count}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </details>
      ))}
    </div>
  );

  return (
    <div className="grid gap-10 lg:grid-cols-[280px_1fr]">
      <aside className="hidden lg:block" aria-label="Filters">
        <p className="eyebrow mb-4 text-ink-soft">{kindLabel === "trouwjurken" ? "Dressfinder" : "Filter"}</p>
        {facets}
      </aside>

      <div>
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <button type="button" className="btn-ghost !py-2.5 lg:hidden" onClick={() => setOpen(true)} aria-expanded={open} aria-controls="filter-drawer">
            <Icon name="filter" className="h-4 w-4" /> Filter
          </button>
          <p className="text-sm text-ink-soft" aria-live="polite">
            <strong className="text-ink">{filtered.length}</strong> {kindLabel}
          </p>
          <label className="ml-auto flex items-center gap-2 text-sm">
            <span className="text-ink-soft">Sorteer</span>
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-full border border-line bg-white px-4 py-2">
              <option value="standaard">Uitgelicht</option>
              <option value="nieuw">Nieuwste eerst</option>
              <option value="prijs-laag">Prijs laag – hoog</option>
              <option value="prijs-hoog">Prijs hoog – laag</option>
            </select>
          </label>
        </div>

        {active.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2">
            {active.map(({ g, v }) => (
              <button key={g + v} type="button" onClick={() => toggle(g, v)} className="inline-flex items-center gap-1.5 rounded-full bg-lilac px-3 py-1.5 text-sm hover:bg-lilac-300">
                {v} <Icon name="close" className="h-3.5 w-3.5" />
                <span className="sr-only">filter verwijderen</span>
              </button>
            ))}
            <button type="button" onClick={() => setSelected({})} className="px-2 text-sm underline">
              Wis alles
            </button>
          </div>
        )}

        <ul className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 md:grid-cols-3">
          {items.map((p, i) => (
            <li key={p.id} className={visible.has(p.id) ? "" : "hidden"} style={{ order: order.get(p.id) ?? 9999 }}>
              <ProductCard p={p} priority={i < 3} sizes="(max-width: 768px) 50vw, 30vw" />
            </li>
          ))}
        </ul>
        {filtered.length === 0 && <p className="rounded-2xl bg-cream p-8 text-center text-ink-soft">Geen {kindLabel} gevonden met deze combinatie. Probeer een filter minder.</p>}
        {filtered.length > limit && (
          <div className="mt-12 text-center">
            <p className="mb-4 text-sm text-ink-soft">
              Je bekijkt {limit} van {filtered.length} {kindLabel}
            </p>
            <button type="button" className="btn-primary" onClick={() => setLimit((l) => l + STEP)}>
              Meer laden
            </button>
          </div>
        )}
      </div>

      {/* Filterlade op mobiel */}
      <div id="filter-drawer" className={`fixed inset-0 z-[65] lg:hidden ${open ? "" : "pointer-events-none"}`} aria-hidden={!open} inert={!open}>
        <div className={`absolute inset-0 bg-ink/50 transition-opacity ${open ? "opacity-100" : "opacity-0"}`} onClick={() => setOpen(false)} />
        <div role="dialog" aria-label="Filters" className={`absolute inset-y-0 left-0 flex w-[88%] max-w-sm flex-col bg-cream transition-transform duration-500 ${open ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="flex items-center justify-between border-b border-line p-4">
            <p className="font-serif text-2xl">Filter</p>
            <button type="button" className="rounded-full p-2" onClick={() => setOpen(false)} aria-label="Filters sluiten">
              <Icon name="close" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">{facets}</div>
          <div className="border-t border-line p-4">
            <button type="button" className="btn-primary w-full" onClick={() => setOpen(false)}>
              Toon {filtered.length} {kindLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
