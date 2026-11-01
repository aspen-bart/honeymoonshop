import { saveAppointmentSettings, saveSiteSettings } from "@/app/admin/actions/manage";
import { SimpleForm } from "@/components/admin/SimpleForm";
import { Field, PageHeader, Panel, input } from "@/components/admin/ui";
import { requireUser } from "@/lib/auth";
import { getAppointmentSettings, getHome, getSite } from "@/lib/settings";

export const metadata = { title: "Instellingen" };
const DAYS = ["zo", "ma", "di", "wo", "do", "vr", "za"];

export default async function SettingsAdmin() {
  await requireUser("admin");
  const [site, home, appt] = await Promise.all([getSite(), getHome(), getAppointmentSettings()]);
  const hours = [...site.openingHours, ...Array.from({ length: Math.max(0, 7 - site.openingHours.length) }, () => ({ label: "", days: [] as number[], opens: "", closes: "" }))];
  return (
    <>
      <PageHeader title="Instellingen" description="Eén centrale plek voor bedrijfsgegevens: header, footer, structured data en sitemap gebruiken deze waarden." />
      <div className="space-y-6">
        <Panel title="Winkel, homepage en contact">
          <SimpleForm action={saveSiteSettings}>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Naam">
                <input name="name" defaultValue={site.name} className={input} />
              </Field>
              <Field label="Juridische naam">
                <input name="legalName" defaultValue={site.legalName} className={input} />
              </Field>
              <Field label="KvK-nummer">
                <input name="kvk" defaultValue={site.kvk} className={input} />
              </Field>
              <Field label="Omschrijving (structured data)" className="sm:col-span-3">
                <input name="tagline" defaultValue={site.tagline} className={input} />
              </Field>
              <Field label="Straat en huisnummer">
                <input name="street" defaultValue={site.street} className={input} />
              </Field>
              <Field label="Postcode">
                <input name="postalCode" defaultValue={site.postalCode} className={input} />
              </Field>
              <Field label="Plaats">
                <input name="city" defaultValue={site.city} className={input} />
              </Field>
              <Field label="Telefoon (weergave)">
                <input name="phone" defaultValue={site.phone} className={input} />
              </Field>
              <Field label="Telefoon (internationaal)">
                <input name="phoneIntl" defaultValue={site.phoneIntl} className={input} />
              </Field>
              <Field label="E-mail">
                <input name="email" type="email" defaultValue={site.email} className={input} />
              </Field>
              {(["facebook", "instagram", "pinterest", "youtube"] as const).map((s) => (
                <Field key={s} label={s[0].toUpperCase() + s.slice(1)}>
                  <input name={s} defaultValue={site.socials[s]} className={input} />
                </Field>
              ))}
              <Field label="Google-score">
                <input name="ratingScore" defaultValue={site.googleRating.score} className={input} />
              </Field>
              <Field label="Aantal Google-reviews">
                <input name="ratingCount" type="number" defaultValue={site.googleRating.count} className={input} />
              </Field>
              <Field label="Link naar Google-reviews" className="sm:col-span-2">
                <input name="ratingUrl" defaultValue={site.googleRating.url} className={input} />
              </Field>
              <Field label="Tekst topbalk">
                <input name="topbar" defaultValue={site.topbar} className={input} />
              </Field>
              <Field label="Opmerking openingstijden" className="sm:col-span-2">
                <input name="closedNote" defaultValue={site.closedNote} className={input} />
              </Field>
            </div>
            <fieldset className="rounded-xl border border-line p-4">
              <legend className="px-1 text-xs font-medium text-ink-soft">Openingstijden (dagen: 0 = zondag … 6 = zaterdag, kommagescheiden)</legend>
              <div className="space-y-2">
                {hours.map((h, i) => (
                  <div key={i} className="grid grid-cols-4 gap-2">
                    <input name={`h${i}_label`} defaultValue={h.label} placeholder="Label, bv. di t/m vr" className={input} aria-label="Label" />
                    <input name={`h${i}_days`} defaultValue={h.days.join(",")} placeholder="2,3,4,5" className={input} aria-label="Dagen" />
                    <input name={`h${i}_opens`} type="time" defaultValue={h.opens} className={input} aria-label="Open" />
                    <input name={`h${i}_closes`} type="time" defaultValue={h.closes} className={input} aria-label="Dicht" />
                  </div>
                ))}
              </div>
            </fieldset>
            <fieldset className="rounded-xl border border-line p-4">
              <legend className="px-1 text-xs font-medium text-ink-soft">Homepage-hero</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Achtergrondvideo (YouTube-link, of mp4/webm-URL)" hint="(leeg = bewegende fotoslideshow)" className="sm:col-span-2">
                  <input name="heroVideo" defaultValue={home.heroVideo} className={`${input} font-mono`} />
                </Field>
                <Field label="Poster / eerste beeld">
                  <input name="heroPoster" defaultValue={home.heroPoster} className={`${input} font-mono`} />
                </Field>
                <Field label="Slideshow-beelden (één pad per regel)">
                  <textarea name="heroImages" defaultValue={home.heroImages.join("\n")} rows={4} className={`${input} font-mono`} />
                </Field>
                <Field label="Bovenregel">
                  <input name="heroEyebrow" defaultValue={home.heroEyebrow} className={input} />
                </Field>
                <Field label="Titel (H1)">
                  <input name="heroTitle" defaultValue={home.heroTitle} className={input} />
                </Field>
                <Field label="Tekst" className="sm:col-span-2">
                  <input name="heroText" defaultValue={home.heroText} className={input} />
                </Field>
                <Field label="Tegel “Alles voor de bruid” (beeld)">
                  <input name="brideImage" defaultValue={home.brideImage} className={`${input} font-mono`} />
                </Field>
                <Field label="Tegel “Alles voor de bruidegom” (beeld)">
                  <input name="groomImage" defaultValue={home.groomImage} className={`${input} font-mono`} />
                </Field>
              </div>
            </fieldset>
          </SimpleForm>
        </Panel>

        <Panel title="Afsprakenplanner">
          <SimpleForm action={saveAppointmentSettings}>
            <div className="grid gap-4 sm:grid-cols-4">
              <Field label="Plekken per tijdslot">
                <input name="capacityPerSlot" type="number" min={1} defaultValue={appt.capacityPerSlot} className={input} />
              </Field>
              <Field label="Minimaal dagen vooruit">
                <input name="leadDays" type="number" min={0} defaultValue={appt.leadDays} className={input} />
              </Field>
              <Field label="Maximaal dagen vooruit">
                <input name="maxDaysAhead" type="number" min={14} defaultValue={appt.maxDaysAhead} className={input} />
              </Field>
              <Field label="Melding naar e-mail">
                <input name="notifyEmail" type="email" defaultValue={appt.notifyEmail} className={input} />
              </Field>
              <Field label="Gesloten dagen (JJJJ-MM-DD, gescheiden door spaties)" className="sm:col-span-4">
                <textarea name="closedDates" defaultValue={appt.closedDates.join(" ")} rows={2} className={`${input} font-mono`} />
              </Field>
            </div>
            {appt.types.map((t) => (
              <fieldset key={t.key} className="rounded-xl border border-line p-4">
                <legend className="px-1 text-sm font-medium">{t.label}</legend>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Naam">
                    <input name={`${t.key}_label`} defaultValue={t.label} className={input} />
                  </Field>
                  <Field label="Duur (minuten)">
                    <input name={`${t.key}_duration`} type="number" defaultValue={t.durationMin} className={input} />
                  </Field>
                  <Field label="Omschrijving">
                    <input name={`${t.key}_description`} defaultValue={t.description} className={input} />
                  </Field>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-7">
                  {DAYS.map((d, i) => (
                    <Field key={d} label={d}>
                      <input name={`${t.key}_${i}`} defaultValue={(t.slots[String(i)] ?? []).join(" ")} placeholder="09:30 12:30" className={`${input} font-mono !text-xs`} />
                    </Field>
                  ))}
                </div>
              </fieldset>
            ))}
          </SimpleForm>
        </Panel>
      </div>
    </>
  );
}
