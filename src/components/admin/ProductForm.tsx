"use client";
import { useState } from "react";
import type { ActionResult } from "./fields";
import { AdminForm, ImageListEditor, RichText, SeoFields } from "./fields";
import { Field, Panel, input } from "./ui";

type Option = { id: string; name: string; kind: string };
type Group = { name: string; terms: { name: string; slug: string }[] };
export type ProductData = {
  kind: string;
  name: string;
  path: string;
  brandId: string | null;
  articleNumber: string | null;
  sku: string | null;
  descriptionHtml: string;
  priceText: string | null;
  priceMin: number | null;
  priceMax: number | null;
  price: number | null;
  images: { src: string; alt: string }[];
  attributes: Record<string, string[]>;
  categoryIds: string[];
  sale: boolean;
  featured: boolean;
  status: string;
  sortOrder: number;
  tryOn: { x: number; y: number; size: number } | null;
  metaTitle: string | null;
  metaDescription: string | null;
};

export function ProductForm({ data, action, aiAction, aiEnabled, brands, categories, filters, readOnly }: { data: ProductData; action: (s: ActionResult, f: FormData) => Promise<ActionResult>; aiAction: (f: FormData) => Promise<{ text?: string; error?: string }>; aiEnabled: boolean; brands: Option[]; categories: Option[]; filters: Record<string, Group[]>; readOnly: boolean }) {
  const [kind, setKind] = useState(data.kind);
  const [attrs, setAttrs] = useState(data.attributes);
  const [spot, setSpot] = useState(data.tryOn ?? { x: 50, y: 13, size: 15 });
  const groups = filters[kind] ?? [];
  const toggleAttr = (g: string, v: string) => setAttrs((a) => ({ ...a, [g]: a[g]?.includes(v) ? a[g].filter((x) => x !== v) : [...(a[g] ?? []), v] }));
  const firstImage = data.images[0]?.src;

  return (
    <AdminForm
      action={action}
      readOnly={readOnly}
      aside={
        <>
          <Panel title="Publicatie">
            <div className="space-y-3">
              <Field label="Status">
                <select name="status" defaultValue={data.status} className={input}>
                  <option value="published">Gepubliceerd</option>
                  <option value="draft">Concept</option>
                </select>
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="featured" defaultChecked={data.featured} /> Uitgelicht op de homepage
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="sale" defaultChecked={data.sale} /> Sale-label tonen
              </label>
              <Field label="Volgorde" hint="(lager = eerder)">
                <input name="sortOrder" type="number" defaultValue={data.sortOrder} className={input} />
              </Field>
            </div>
          </Panel>
          <Panel title="Categorieën en collecties">
            <div className="max-h-72 space-y-1 overflow-y-auto">
              {categories
                .filter((c) => c.kind === kind)
                .map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="categoryIds" value={c.id} defaultChecked={data.categoryIds.includes(c.id)} /> {c.name}
                  </label>
                ))}
              {!categories.some((c) => c.kind === kind) && <p className="text-sm text-ink-soft">Geen categorieën voor dit soort product.</p>}
            </div>
          </Panel>
        </>
      }
    >
      <Panel title="Basis">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Soort">
            <select name="kind" value={kind} onChange={(e) => setKind(e.target.value)} className={input}>
              <option value="dress">Trouwjurk</option>
              <option value="suit">Trouwpak</option>
              <option value="accessory">Accessoire</option>
            </select>
          </Field>
          <Field label="Merk">
            <select name="brandId" defaultValue={data.brandId ?? ""} className={input}>
              <option value="">Geen merk</option>
              {brands
                .filter((b) => b.kind === kind)
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Naam (H1)" className="sm:col-span-2">
            <input name="name" defaultValue={data.name} required className={input} />
          </Field>
          <Field label="URL-pad" hint="(leeg = automatisch; wijzigen maakt een 301-redirect)" className="sm:col-span-2">
            <input name="path" defaultValue={data.path} placeholder="/trouwjurken/trouwjurk-naam-merk/" className={`${input} font-mono`} />
          </Field>
          <Field label="Artikelnummer">
            <input name="articleNumber" defaultValue={data.articleNumber ?? ""} className={input} />
          </Field>
          <Field label="SKU">
            <input name="sku" defaultValue={data.sku ?? ""} className={input} />
          </Field>
        </div>
      </Panel>

      <Panel title="Omschrijving">
        <RichText name="descriptionHtml" value={data.descriptionHtml} minHeight={180} />
      </Panel>

      <Panel title="Prijs">
        {kind === "accessory" ? (
          <Field label="Prijs in euro">
            <input name="price" type="number" step="0.01" defaultValue={data.price ?? ""} className={input} />
          </Field>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Prijsindicatie (tekst)">
              <input name="priceText" defaultValue={data.priceText ?? ""} placeholder="€1750 - €2000" className={input} />
            </Field>
            <Field label="Van (€)">
              <input name="priceMin" type="number" defaultValue={data.priceMin ?? ""} className={input} />
            </Field>
            <Field label="Tot (€)">
              <input name="priceMax" type="number" defaultValue={data.priceMax ?? ""} className={input} />
            </Field>
          </div>
        )}
      </Panel>

      <Panel title="Foto's">
        <ImageListEditor name="images" value={data.images} />
      </Panel>

      {groups.length > 0 && (
        <Panel title="Kenmerken (dressfinder-filters)">
          <input type="hidden" name="attributes" value={JSON.stringify(attrs)} />
          <div className="grid gap-5 sm:grid-cols-2">
            {groups.map((g) => (
              <fieldset key={g.name}>
                <legend className="mb-2 text-xs font-medium text-ink-soft">{g.name}</legend>
                <div className="flex flex-wrap gap-1.5">
                  {g.terms.map((t) => {
                    const on = attrs[g.name]?.includes(t.name);
                    return (
                      <button key={t.slug} type="button" aria-pressed={on} onClick={() => toggleAttr(g.name, t.name)} className={`rounded-full border px-3 py-1 text-xs ${on ? "border-ink bg-ink text-white" : "border-line hover:border-ink"}`}>
                        {t.name}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </div>
        </Panel>
      )}

      {kind !== "accessory" && firstImage && (
        <Panel title="Online passen: positie van het hoofd">
          <input type="hidden" name="tryOn" value={JSON.stringify(spot)} />
          <div className="grid gap-5 sm:grid-cols-[220px_1fr]">
            <button
              type="button"
              className="relative aspect-[3/4] w-full cursor-crosshair overflow-hidden rounded-xl bg-cream"
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                setSpot({ ...spot, x: Math.round(((e.clientX - r.left) / r.width) * 1000) / 10, y: Math.round(((e.clientY - r.top) / r.height) * 1000) / 10 });
              }}
              aria-label="Klik op het gezicht van het model"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={firstImage} alt="" className="h-full w-full object-cover" />
              <span className="absolute aspect-[4/5] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-lilac/50" style={{ left: `${spot.x}%`, top: `${spot.y}%`, width: `${spot.size}%` }} />
            </button>
            <div className="space-y-3 text-sm">
              <p className="text-ink-soft">Klik op het gezicht van het model in de eerste foto. Bezoekers die “Upload jezelf 🙂” gebruiken, zien hun gezicht dan direct op de juiste plek.</p>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-soft">Grootte van het gezicht ({spot.size}%)</span>
                <input type="range" min={5} max={40} step={0.5} value={spot.size} onChange={(e) => setSpot({ ...spot, size: Number(e.target.value) })} className="w-full" />
              </label>
            </div>
          </div>
        </Panel>
      )}

      <Panel title="Zoekmachines (SEO)">
        <SeoFields metaTitle={data.metaTitle} metaDescription={data.metaDescription} aiAction={aiAction} aiEnabled={aiEnabled} />
      </Panel>
    </AdminForm>
  );
}
