import Link from "next/link";
import { adjustPrices, savePrices } from "@/app/admin/actions/extra";
import { SimpleForm } from "@/components/admin/SimpleForm";
import { Field, PageHeader, Panel, btn, input } from "@/components/admin/ui";
import { can, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { images } from "@/lib/json";
import { like } from "@/lib/search";

export const metadata = { title: "Prijzen" };

const PER = 60;
const KINDS = [
  { value: "dress", label: "Trouwjurken" },
  { value: "suit", label: "Trouwpakken" },
  { value: "accessory", label: "Accessoires" },
];

// Prijzen beheren: een bewerkbare tabel (alle regels in één keer opslaan) en een bulkaanpassing voor de hele selectie.
export default async function PricesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.pagina) || 1);
  const where = {
    ...(sp.q ? { OR: [{ name: like(sp.q) }, { articleNumber: like(sp.q) }] } : {}),
    ...(sp.soort ? { kind: sp.soort } : {}),
    ...(sp.merk ? { brandId: sp.merk } : {}),
    ...(sp.categorie ? { categories: { some: { id: sp.categorie } } } : {}),
    ...(sp.zonder ? { priceMin: null, price: null } : {}),
    ...(sp.sale ? { sale: true } : {}),
  };
  const [rows, total, allIds, brands, cats] = await Promise.all([
    db.product.findMany({ where, include: { brand: true }, orderBy: [{ kind: "asc" }, { name: "asc" }], skip: (page - 1) * PER, take: PER }),
    db.product.count({ where }),
    db.product.findMany({ where, select: { id: true }, take: 3000 }),
    db.brand.findMany({ where: sp.soort ? { kind: sp.soort } : {}, orderBy: { name: "asc" } }),
    db.category.findMany({ where: sp.soort ? { kind: sp.soort } : {}, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PER));
  const qs = (p: number) => `?${new URLSearchParams({ ...sp, pagina: String(p) })}`;
  const editor = can(user, "editor");
  return (
    <>
      <PageHeader title="Prijzen" description="Prijsindicaties van jurken en pakken (van–tot) en vaste prijzen van accessoires. Pas regels aan en sla alles in één keer op." />
      <form action="/admin/shop/prijzen/" className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-white p-4" role="search">
        <input name="q" defaultValue={sp.q} placeholder="Zoek op naam of artikelnummer" className={`${input} min-w-[200px] flex-1`} type="search" aria-label="Zoeken" />
        <select name="soort" defaultValue={sp.soort ?? ""} className={`${input} !w-auto`} aria-label="Soort">
          <option value="">Alle soorten</option>
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
        <select name="merk" defaultValue={sp.merk ?? ""} className={`${input} !w-auto`} aria-label="Merk">
          <option value="">Alle merken</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select name="categorie" defaultValue={sp.categorie ?? ""} className={`${input} !w-auto`} aria-label="Categorie">
          <option value="">Alle categorieën</option>
          {cats.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="zonder" value="1" defaultChecked={!!sp.zonder} /> Zonder prijs
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="sale" value="1" defaultChecked={!!sp.sale} /> Sale
        </label>
        <button className={btn}>Filter</button>
        {Object.keys(sp).some((k) => k !== "pagina") && (
          <Link href="/admin/shop/prijzen/" className="text-sm underline">
            Wissen
          </Link>
        )}
      </form>

      {editor && (
        <Panel title={`Alle ${total} producten in deze selectie aanpassen`} className="mb-4">
          <SimpleForm action={adjustPrices} submitLabel="Prijzen aanpassen">
            <input type="hidden" name="ids" value={allIds.map((r) => r.id).join(",")} />
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Aanpassing" hint="(negatief = verlagen)">
                <input name="amount" type="number" step="0.1" placeholder="bijv. 5 of -10" className={input} required />
              </Field>
              <Field label="In">
                <select name="mode" className={input}>
                  <option value="procent">procent (%)</option>
                  <option value="euro">euro (€)</option>
                </select>
              </Field>
              <Field label="Afronden op">
                <select name="round" defaultValue="10" className={input}>
                  <option value="0">niet afronden</option>
                  <option value="1">hele euro&apos;s</option>
                  <option value="5">€ 5</option>
                  <option value="10">€ 10</option>
                  <option value="50">€ 50</option>
                </select>
              </Field>
            </div>
            <p className="text-xs text-ink-soft">Geldt voor álle producten die aan de filters hierboven voldoen (ook op volgende pagina’s). De prijsindicatie-tekst wordt opnieuw opgebouwd uit van–tot.</p>
          </SimpleForm>
        </Panel>
      )}

      <SimpleForm action={savePrices} submitLabel="Alle prijzen opslaan" readOnly={!editor}>
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wider text-ink-soft">
              <tr>
                <th className="px-3 py-3 font-medium">Product</th>
                <th className="px-3 py-3 font-medium">Prijsindicatie (tekst)</th>
                <th className="px-3 py-3 font-medium">Van €</th>
                <th className="px-3 py-3 font-medium">Tot €</th>
                <th className="px-3 py-3 font-medium">Vaste prijs €</th>
                <th className="px-3 py-3 font-medium">Sale</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => {
                const img = images(r.images)[0];
                return (
                  <tr key={r.id} className="hover:bg-cream/60">
                    <td className="px-3 py-2">
                      <input type="hidden" name="rowId" value={r.id} />
                      <div className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {img ? <img src={img.src} alt="" loading="lazy" className="h-12 w-9 rounded object-cover" /> : <span className="h-12 w-9 rounded bg-cream" />}
                        <div>
                          <Link href={`/admin/shop/producten/${r.id}/bewerken/`} className="font-medium hover:underline">
                            {r.name}
                          </Link>
                          <p className="text-xs text-ink-soft">{r.brand?.name ?? KINDS.find((k) => k.value === r.kind)?.label}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <input name={`${r.id}_text`} defaultValue={r.priceText ?? ""} disabled={r.kind === "accessory"} placeholder={r.kind === "accessory" ? "–" : "€1750 - €2000"} className={`${input} !py-1.5 min-w-[150px]`} aria-label={`Prijsindicatie ${r.name}`} />
                    </td>
                    <td className="px-3 py-2">
                      <input name={`${r.id}_min`} type="number" min={0} defaultValue={r.priceMin ?? ""} disabled={r.kind === "accessory"} className={`${input} !py-1.5 w-24`} aria-label={`Van-prijs ${r.name}`} />
                    </td>
                    <td className="px-3 py-2">
                      <input name={`${r.id}_max`} type="number" min={0} defaultValue={r.priceMax ?? ""} disabled={r.kind === "accessory"} className={`${input} !py-1.5 w-24`} aria-label={`Tot-prijs ${r.name}`} />
                    </td>
                    <td className="px-3 py-2">
                      <input name={`${r.id}_price`} type="number" min={0} step="0.01" defaultValue={r.price ?? ""} className={`${input} !py-1.5 w-24`} aria-label={`Vaste prijs ${r.name}`} />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input type="checkbox" name={`${r.id}_sale`} defaultChecked={r.sale} aria-label={`Sale ${r.name}`} />
                    </td>
                  </tr>
                );
              })}
              {!rows.length && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-ink-soft">
                    Geen producten gevonden.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="autoText" /> Prijsindicatie-tekst automatisch maken uit van–tot (bv. “€1750 - €2000”)
          </label>
          <p className="text-sm text-ink-soft">
            {total} producten · pagina {page} van {pages}{" "}
            {page > 1 && (
              <Link href={qs(page - 1)} className="ml-2 underline">
                Vorige
              </Link>
            )}
            {page < pages && (
              <Link href={qs(page + 1)} className="ml-2 underline">
                Volgende
              </Link>
            )}
          </p>
        </div>
      </SimpleForm>
    </>
  );
}
