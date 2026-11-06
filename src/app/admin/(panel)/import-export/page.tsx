import { runImport } from "@/app/admin/actions/extra";
import { Icon } from "@/components/Icon";
import { SimpleForm } from "@/components/admin/SimpleForm";
import { Field, PageHeader, Panel, btnSm, input } from "@/components/admin/ui";
import { EXPORT_TYPES, type ExportType } from "@/lib/admin/transfer";
import { can, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata = { title: "Import / export" };

// Exporteren (JSON om terug te zetten, CSV voor Excel) en importeren van content.
export default async function ImportExportPage() {
  const user = await requireUser("editor");
  const [posts, pages, products, categories, reviews, brands, redirects, appointments, messages, tickets, media] = await Promise.all([db.post.count(), db.page.count(), db.product.count(), db.category.count(), db.review.count(), db.brand.count(), db.redirect.count(), db.appointment.count(), db.contactMessage.count(), db.ticket.count(), db.media.count()]);
  const counts: Record<ExportType, number> = { posts, pages, products, categories, reviews, brands, redirects, seo: posts + pages + products + categories + reviews, prices: products, appointments, messages, tickets, media };
  const groups: { title: string; types: ExportType[] }[] = [
    { title: "Content", types: ["posts", "pages", "reviews"] },
    { title: "Shop", types: ["products", "prices", "categories", "brands"] },
    { title: "SEO", types: ["seo", "redirects"] },
    { title: "Data", types: ["appointments", "messages", "tickets", "media"] },
  ];
  return (
    <>
      <PageHeader title="Import / export" description="Blogs, pagina's, producten en alle andere data downloaden of terugzetten. JSON bevat alles (om terug te importeren), CSV opent direct in Excel." />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {can(user, "admin") && (
            <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-ink p-6 text-white">
              <div>
                <h2 className="font-sans text-lg font-semibold text-white">Volledige back-up</h2>
                <p className="text-sm text-white/75">Alle pagina&apos;s, blogs, producten, categorieën, merken, reviews, redirects en instellingen in één JSON-bestand. Zonder gebruikers en API-sleutels.</p>
              </div>
              <a href="/api/admin/export/?type=full" className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-medium text-ink hover:bg-lilac">
                <Icon name="download" className="h-4 w-4" /> Back-up downloaden
              </a>
            </section>
          )}
          {groups.map((g) => (
            <Panel key={g.title} title={`Exporteren · ${g.title}`}>
              <ul className="divide-y divide-line">
                {g.types.map((t) => {
                  const meta = EXPORT_TYPES[t];
                  const jsonOk = !["seo", "prices"].includes(t);
                  return (
                    <li key={t} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div>
                        <p className="font-medium">{meta.label}</p>
                        <p className="text-xs text-ink-soft">
                          {counts[t]} regels{meta.importable ? ` · terug te importeren als ${meta.importable.toUpperCase().replace("+", " of ")}` : " · alleen export"}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {jsonOk && (
                          <a href={`/api/admin/export/?type=${t}&format=json`} className={btnSm}>
                            <Icon name="download" className="h-3.5 w-3.5" /> JSON
                          </a>
                        )}
                        <a href={`/api/admin/export/?type=${t}&format=csv`} className={btnSm}>
                          <Icon name="download" className="h-3.5 w-3.5" /> CSV (Excel)
                        </a>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          ))}
        </div>

        <aside className="space-y-6">
          <Panel title="Importeren">
            {can(user, "admin") ? (
              <SimpleForm action={runImport} submitLabel="Importeren">
                <Field label="Bestand" hint="(.json uit deze export, of .csv)">
                  <input type="file" name="file" accept=".json,.csv,application/json,text/csv" required className={`${input} !py-1.5`} />
                </Field>
                <Field label="Soort (alleen nodig bij CSV)">
                  <select name="type" className={input}>
                    <option value="">Automatisch herkennen</option>
                    <option value="seo">SEO: meta-gegevens</option>
                    <option value="prices">Prijzen</option>
                    <option value="redirects">Redirects</option>
                  </select>
                </Field>
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" name="overwrite" defaultChecked className="mt-1" /> Bestaande items overschrijven (zelfde URL). Uit = alleen nieuwe toevoegen.
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" name="dryRun" defaultChecked className="mt-1" /> Eerst proefdraaien (laat zien wat er zou gebeuren, slaat niets op)
                </label>
              </SimpleForm>
            ) : (
              <p className="text-sm text-ink-soft">Alleen beheerders kunnen importeren.</p>
            )}
          </Panel>
          <Panel title="Zo werkt importeren">
            <ul className="list-disc space-y-2 pl-5 text-sm text-ink-soft">
              <li>Items worden herkend aan hun URL (pad). Bestaat de URL al, dan wordt het item bijgewerkt.</li>
              <li>JSON: blogs, pagina&apos;s, producten, categorieën, merken, reviews, redirects of een volledige back-up.</li>
              <li>CSV: pas meta-teksten, prijzen of redirects aan in Excel en zet ze terug. Laat de kolomnamen staan.</li>
              <li>Afbeeldingen zitten niet in de export; de paden verwijzen naar de mediabibliotheek.</li>
              <li>Elke import komt in het logboek.</li>
            </ul>
          </Panel>
        </aside>
      </div>
    </>
  );
}
