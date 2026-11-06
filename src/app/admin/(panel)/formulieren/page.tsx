import Link from "next/link";
import { saveFormSettings } from "@/app/admin/actions/extra";
import { SimpleForm } from "@/components/admin/SimpleForm";
import { Badge, Field, PageHeader, btnSm, input } from "@/components/admin/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { FORM_LABELS, getConnections, getForms, type FormKey } from "@/lib/settings";

export const metadata = { title: "Formulieren" };

// Per formulier: wie krijgt een melding, of de bezoeker een bevestiging krijgt en welke tekst er na versturen staat.
export default async function FormsAdmin() {
  await requireUser("admin");
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [forms, conn, appts, contact, lookbook, stories] = await Promise.all([
    getForms(),
    getConnections(),
    db.appointment.count({ where: { createdAt: { gte: since } } }),
    db.contactMessage.count({ where: { createdAt: { gte: since }, NOT: { subject: { in: ["Aanvraag gratis Look Book", "Nieuw real-bride-verhaal ingestuurd"] } } } }),
    db.contactMessage.count({ where: { createdAt: { gte: since }, subject: "Aanvraag gratis Look Book" } }),
    db.contactMessage.count({ where: { createdAt: { gte: since }, subject: "Nieuw real-bride-verhaal ingestuurd" } }),
  ]);
  const counts: Record<FormKey, number> = { afspraak: appts, contact, lookbook, verhaal: stories };
  const mailOn = conn.sparkpost.enabled && !!conn.sparkpost.keyEnc;
  return (
    <>
      <PageHeader title="Formulieren" description="Meldingen, bevestigingsmails en bedankteksten van alle formulieren op de website. Aanvragen komen altijd in het beheer binnen, ook zonder e-mail." />
      {!mailOn && (
        <p className="mb-6 rounded-xl bg-cream px-4 py-3 text-sm text-ink-soft">
          E-mail staat uit: zet <Link href="/admin/connecties/#sparkpost" className="underline">SparkPost</Link> aan om meldingen en bevestigingen te versturen.
        </p>
      )}
      <div className="space-y-6">
        {(Object.keys(FORM_LABELS) as FormKey[]).map((key) => {
          const f = forms[key];
          const meta = FORM_LABELS[key];
          return (
            <section key={key} id={key} className="rounded-2xl border border-line bg-white p-6">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-sans text-lg font-semibold">{meta.label}</h2>
                  <p className="text-sm text-ink-soft">
                    Op <a href={meta.where} target="_blank" className="font-mono text-xs underline">{meta.where}</a> · {counts[key]} inzendingen in de laatste 30 dagen
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={f.notify && mailOn ? "success" : "neutral"}>melding {f.notify && mailOn ? "aan" : "uit"}</Badge>
                  <Badge tone={f.confirm && mailOn ? "success" : "neutral"}>bevestiging {f.confirm && mailOn ? "aan" : "uit"}</Badge>
                  <Link href={meta.inbox} className={btnSm}>
                    Inzendingen →
                  </Link>
                </div>
              </div>
              <SimpleForm action={saveFormSettings.bind(null, key)}>
                <div className="grid gap-6 lg:grid-cols-2">
                  <fieldset className="space-y-4 rounded-xl border border-line p-4">
                    <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-ink-soft">Melding naar de winkel</legend>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="notify" defaultChecked={f.notify} /> E-mail sturen bij elke inzending
                    </label>
                    <Field label="Naar" hint="(meerdere adressen scheiden met een komma)">
                      <input name="to" defaultValue={f.to} className={input} />
                    </Field>
                    <Field label="Onderwerp">
                      <input name="subject" defaultValue={f.subject} className={input} />
                    </Field>
                  </fieldset>
                  <fieldset className="space-y-4 rounded-xl border border-line p-4">
                    <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-ink-soft">Bevestiging naar de bezoeker</legend>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="confirm" defaultChecked={f.confirm} /> Bevestigingsmail sturen
                    </label>
                    <Field label="Onderwerp">
                      <input name="confirmSubject" defaultValue={f.confirmSubject} className={input} />
                    </Field>
                    <Field label="Tekst">
                      <textarea name="confirmText" defaultValue={f.confirmText} rows={6} className={input} />
                    </Field>
                  </fieldset>
                </div>
                {key !== "afspraak" && (
                  <Field label="Melding op de website na versturen" hint="(leeg = standaardtekst)">
                    <input name="successText" defaultValue={f.successText} className={input} />
                  </Field>
                )}
                <p className="text-xs text-ink-soft">Beschikbare velden: {meta.vars}</p>
              </SimpleForm>
            </section>
          );
        })}
      </div>
    </>
  );
}
