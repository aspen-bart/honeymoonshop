import Link from "next/link";
import { renameAttribute, saveSpecFields } from "@/app/admin/actions/extra";
import { SimpleForm } from "@/components/admin/SimpleForm";
import { Badge, Field, PageHeader, Panel, input } from "@/components/admin/ui";
import { can, requireUser } from "@/lib/auth";
import { FILTERS } from "@/lib/content";
import { db } from "@/lib/db";
import { attributes } from "@/lib/json";
import { getSpecs, type ProductKind } from "@/lib/settings";

export const metadata = { title: "Specificaties" };

const KINDS: { value: ProductKind; label: string }[] = [
  { value: "dress", label: "Trouwjurken" },
  { value: "suit", label: "Trouwpakken" },
  { value: "accessory", label: "Accessoires" },
];
const HIDDEN = ["Prijs", "Merk", "Merken"];

// Specificaties per soort product: filterkenmerken (dressfinder) met gebruik per waarde, en vrije velden
// (Levertijd, Maten, …) die in elk productformulier klaarstaan. Waarden hernoem/verwijder je in één keer bij alle producten.
export default async function SpecsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const kind = (KINDS.find((k) => k.value === sp.soort)?.value ?? "dress") as ProductKind;
  const [specs, products] = await Promise.all([getSpecs(), db.product.findMany({ where: { kind }, select: { attributes: true } })]);
  const usage = new Map<string, Map<string, number>>();
  for (const p of products)
    for (const [g, vals] of Object.entries(attributes(p.attributes))) {
      if (HIDDEN.includes(g)) continue;
      const m = usage.get(g) ?? new Map<string, number>();
      for (const v of vals) m.set(v, (m.get(v) ?? 0) + 1);
      usage.set(g, m);
    }
  const filterGroups = kind === "accessory" ? [] : FILTERS[kind].filter((g) => !HIDDEN.includes(g.name));
  const filterNames = new Set(filterGroups.map((g) => g.name));
  const freeGroups = [...usage.keys()].filter((g) => !filterNames.has(g)).sort();
  const editor = can(user, "editor");

  const valueList = (group: string, values: { name: string; count: number; known: boolean }[]) => (
    <ul className="divide-y divide-line text-sm">
      {values.map((v) => (
        <li key={v.name} className="flex flex-wrap items-center justify-between gap-2 py-2">
          <span className="flex items-center gap-2">
            {v.name}
            {!v.known && <Badge tone="warning">niet in filter</Badge>}
          </span>
          <span className="flex items-center gap-3">
            <span className="text-xs text-ink-soft" title="Aantal producten met deze waarde">
              {v.count} producten
            </span>
            {editor && v.count > 0 && (
              <details className="relative">
                <summary className="cursor-pointer list-none text-xs text-lilac-700 underline">Hernoemen / verwijderen</summary>
                <div className="absolute right-0 z-10 mt-2 w-72 rounded-xl border border-line bg-white p-3 shadow-lg">
                  <SimpleForm action={renameAttribute} submitLabel="Toepassen op alle producten">
                    <input type="hidden" name="kind" value={kind} />
                    <input type="hidden" name="group" value={group} />
                    <input type="hidden" name="from" value={v.name} />
                    <Field label={`“${v.name}” wordt`} hint="(leeg = verwijderen)">
                      <input name="to" defaultValue={v.name} className={input} />
                    </Field>
                  </SimpleForm>
                </div>
              </details>
            )}
          </span>
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <PageHeader title="Specificaties" description="Kenmerken en specificaties van producten. Filterkenmerken bepalen de filters op de site; vrije specificaties staan op de productpagina." />
      <nav className="mb-6 flex flex-wrap gap-2" aria-label="Soort product">
        {KINDS.map((k) => (
          <Link key={k.value} href={`/admin/shop/specificaties/?soort=${k.value}`} aria-current={kind === k.value ? "page" : undefined} className={`rounded-full border px-4 py-1.5 text-sm ${kind === k.value ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink"}`}>
            {k.label}
          </Link>
        ))}
      </nav>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {filterGroups.length > 0 && (
            <Panel title="Filterkenmerken (filters op de site)">
              <div className="space-y-3">
                {filterGroups.map((g) => {
                  const used = usage.get(g.name) ?? new Map<string, number>();
                  const values = [...g.terms.map((t) => ({ name: t.name, count: used.get(t.name) ?? 0, known: true })), ...[...used.entries()].filter(([v]) => !g.terms.some((t) => t.name === v)).map(([name, count]) => ({ name, count, known: false }))];
                  return (
                    <details key={g.name} className="rounded-xl border border-line px-4 py-2" open={filterGroups.length <= 2}>
                      <summary className="flex cursor-pointer items-center justify-between py-1 font-medium">
                        {g.name} <span className="text-xs font-normal text-ink-soft">{g.terms.length} waarden</span>
                      </summary>
                      {valueList(g.name, values)}
                    </details>
                  );
                })}
              </div>
              <p className="mt-3 text-xs text-ink-soft">Waarden aanvinken doe je per product (Producten → bewerken → Kenmerken). Een waarde hernoemen werkt direct bij alle producten.</p>
            </Panel>
          )}

          <Panel title="Vrije specificaties in gebruik">
            {freeGroups.length ? (
              <div className="space-y-3">
                {freeGroups.map((g) => (
                  <details key={g} className="rounded-xl border border-line px-4 py-2">
                    <summary className="flex cursor-pointer items-center justify-between py-1 font-medium">
                      {g} <span className="text-xs font-normal text-ink-soft">{usage.get(g)!.size} verschillende waarden</span>
                    </summary>
                    {valueList(
                      g,
                      [...usage.get(g)!.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count, known: true })),
                    )}
                  </details>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-soft">Nog geen vrije specificaties ingevuld bij deze producten.</p>
            )}
          </Panel>
        </div>

        <aside>
          <Panel title="Vaste velden in het productformulier">
            <SimpleForm action={saveSpecFields} readOnly={!editor}>
              <Field label={`Velden voor ${KINDS.find((k) => k.value === kind)!.label.toLowerCase()}`} hint="(één per regel)">
                <textarea name={kind} defaultValue={specs[kind].join("\n")} rows={8} className={input} />
              </Field>
              <p className="text-xs text-ink-soft">Deze velden staan klaar bij elk product van deze soort, bv. Levertijd, Maten of Stof. Extra specificaties kun je per product altijd toevoegen.</p>
            </SimpleForm>
          </Panel>
        </aside>
      </div>
    </>
  );
}
