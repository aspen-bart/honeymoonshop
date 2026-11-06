import { saveAi, saveAiImage, saveGtm, testAiConnection, testAiImageConnection, testGtm } from "@/app/admin/actions/manage";
import { saveGtmCode, savePulse, saveSparkpost, sendTestMail, testPulseConnection, testSparkpostConnection } from "@/app/admin/actions/extra";
import { ActionButton, SimpleForm } from "@/components/admin/SimpleForm";
import { Badge, Field, PageHeader, fmtDateTime, input } from "@/components/admin/ui";
import { GTM_ID } from "@/components/site/Gtm";
import { AI_MODELS, IMAGE_MODELS } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import { getConnections } from "@/lib/settings";

export const metadata = { title: "Connecties" };

const PULSE_EXAMPLE = `{ "source": "honeymoonshop-admin", "project": "…", "reference": "HMS-1001",
  "subject": "…", "description": "…", "type": "bug", "priority": "hoog",
  "status": "open", "url": "https://…", "attachments": ["https://…"],
  "reporter": { "name": "…", "email": "…" }, "createdAt": "…" }`;

function Status({ s }: { s: "actief" | "uit" | "niet ingesteld" | "fout" }) {
  return <Badge tone={s === "actief" ? "success" : s === "fout" ? "danger" : "neutral"}>{s}</Badge>;
}

// Koppelingen met externe diensten. Nieuwe connecties: voeg een sleutel toe aan Connections (lib/settings.ts),
// een kaart hieronder en een save-/test-actie in actions/manage.ts.
export default async function ConnectionsAdmin() {
  await requireUser("admin");
  const c = await getConnections();
  const gtmStatus = !c.gtm.containerId ? "niet ingesteld" : !GTM_ID.test(c.gtm.containerId) ? "fout" : c.gtm.enabled ? "actief" : "uit";
  const aiStatus = !c.ai.keyEnc ? "niet ingesteld" : c.ai.lastTest && !c.ai.lastTest.ok ? "fout" : c.ai.enabled ? "actief" : "uit";
  const spStatus = !c.sparkpost.keyEnc ? "niet ingesteld" : c.sparkpost.lastTest && !c.sparkpost.lastTest.ok ? "fout" : c.sparkpost.enabled ? "actief" : "uit";
  const pulseStatus = !c.pulse.url ? "niet ingesteld" : c.pulse.lastTest && !c.pulse.lastTest.ok ? "fout" : c.pulse.enabled ? "actief" : "uit";
  const aiImageStatus = !c.aiImage.keyEnc ? "niet ingesteld" : c.aiImage.lastTest && !c.aiImage.lastTest.ok ? "fout" : c.aiImage.enabled ? "actief" : "uit";
  return (
    <>
      <PageHeader title="Connecties" description="Koppelingen met externe diensten. API-sleutels worden versleuteld opgeslagen en alleen op de server gebruikt." />
      <div className="grid gap-6 lg:grid-cols-2">
        <section id="gtm" className="rounded-2xl border border-line bg-white p-6 lg:col-span-2">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-sans text-lg font-semibold">Google Tag Manager</h2>
              <p className="text-sm text-ink-soft">Laadt GTM in de head van elke pagina (nooit in het beheer), met Consent Mode v2 en cookiebanner.</p>
            </div>
            <Status s={gtmStatus} />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <SimpleForm action={saveGtm}>
            <Field label="Container-ID" hint="(formaat GTM-XXXXXXX)">
              <input name="containerId" defaultValue={c.gtm.containerId} placeholder="GTM-XXXXXXX" pattern="GTM-[A-Za-z0-9]{4,10}" className={`${input} font-mono uppercase`} />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="enabled" defaultChecked={c.gtm.enabled} /> Actief (aan-uitknop, zonder codewijziging)
            </label>
          </SimpleForm>
          <div className="mt-4 border-t border-line pt-4">
            <ActionButton action={testGtm} label="Verbinding testen" disabled={!c.gtm.containerId} />
          </div>
            </div>
            <SimpleForm action={saveGtmCode} submitLabel="Code opslaan">
              <Field label="Extra code in de <head>" hint="(tekstvak: bv. verificatie-metatags, pixels of scripts)">
                <textarea name="headCode" defaultValue={c.gtm.headCode} rows={5} spellCheck={false} placeholder={"<meta name=\"…\" content=\"…\">"} className={`${input} font-mono text-xs`} />
              </Field>
              <Field label="Extra code direct na <body>" hint="(tekstvak: bv. noscript-fallbacks)">
                <textarea name="bodyCode" defaultValue={c.gtm.bodyCode} rows={4} spellCheck={false} className={`${input} font-mono text-xs`} />
              </Field>
              <p className="text-xs text-ink-soft">Wordt alleen geladen als Tag Manager actief is. Zet trackingcode met cookies bij voorkeur in GTM zelf, dan respecteert die de cookiekeuze van de bezoeker.</p>
            </SimpleForm>
          </div>
        </section>

        <section id="sparkpost" className="rounded-2xl border border-line bg-white p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-sans text-lg font-semibold">SparkPost (e-mail)</h2>
              <p className="text-sm text-ink-soft">Verstuurt meldingen en bevestigingen van de formulieren. Instellen per formulier in <a href="/admin/formulieren/" className="underline">Formulieren</a>.</p>
            </div>
            <Status s={spStatus} />
          </div>
          <SimpleForm action={saveSparkpost}>
            <Field label="API-sleutel" hint={c.sparkpost.keyHint ? `(opgeslagen: ${c.sparkpost.keyHint} — leeg laten = ongewijzigd)` : "(SparkPost → Configuration → API Keys, recht: Transmissions)"}>
              <input name="apiKey" type="password" autoComplete="off" placeholder={c.sparkpost.keyHint || "API-sleutel"} className={`${input} font-mono`} />
            </Field>
            <Field label="Regio" hint="(EU-account = api.eu.sparkpost.com)">
              <select name="region" defaultValue={c.sparkpost.region} className={input}>
                <option value="eu">EU</option>
                <option value="us">US</option>
              </select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Afzender (e-mail)" hint="(geverifieerd domein)">
                <input name="fromEmail" type="email" defaultValue={c.sparkpost.fromEmail} className={input} />
              </Field>
              <Field label="Afzendernaam">
                <input name="fromName" defaultValue={c.sparkpost.fromName} className={input} />
              </Field>
            </div>
            <Field label="Antwoordadres (reply-to)">
              <input name="replyTo" type="email" defaultValue={c.sparkpost.replyTo} className={input} />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="enabled" defaultChecked={c.sparkpost.enabled} /> Actief (formulieren versturen e-mail)
            </label>
          </SimpleForm>
          <div className="mt-4 space-y-3 border-t border-line pt-4">
            <ActionButton action={testSparkpostConnection} label="Verbinding testen" disabled={!c.sparkpost.keyEnc} />
            {c.sparkpost.lastTest && (
              <p className="text-xs text-ink-soft">
                Laatste test {fmtDateTime(new Date(c.sparkpost.lastTest.at))}: {c.sparkpost.lastTest.ok ? "gelukt" : "mislukt"} — {c.sparkpost.lastTest.message}
              </p>
            )}
            {c.sparkpost.keyEnc && (
              <SimpleForm action={sendTestMail} submitLabel="Testmail sturen">
                <Field label="Testmail naar">
                  <input name="to" type="email" placeholder="jouw@e-mailadres.nl" className={input} />
                </Field>
              </SimpleForm>
            )}
          </div>
        </section>

        <section id="pulse" className="rounded-2xl border border-line bg-white p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-sans text-lg font-semibold">Pulse (tickets)</h2>
              <p className="text-sm text-ink-soft">Tickets uit <a href="/admin/tickets/" className="underline">Tickets</a> en de knop “Ticket melden” gaan als JSON naar Pulse.</p>
            </div>
            <Status s={pulseStatus} />
          </div>
          <SimpleForm action={savePulse}>
            <Field label="Pulse-URL" hint="(endpoint of webhook voor nieuwe tickets)">
              <input name="url" type="url" defaultValue={c.pulse.url} placeholder="https://…" className={`${input} font-mono text-xs`} />
            </Field>
            <Field label="API-sleutel / token" hint={c.pulse.keyHint ? `(opgeslagen: ${c.pulse.keyHint} — leeg laten = ongewijzigd)` : "(wordt meegestuurd als Bearer-token)"}>
              <input name="apiKey" type="password" autoComplete="off" placeholder={c.pulse.keyHint || "token"} className={`${input} font-mono`} />
            </Field>
            <Field label="Project / klant-ID in Pulse" hint="(optioneel)">
              <input name="projectId" defaultValue={c.pulse.projectId} className={input} />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="enabled" defaultChecked={c.pulse.enabled} /> Actief (nieuwe tickets automatisch doorsturen)
            </label>
          </SimpleForm>
          <div className="mt-4 space-y-2 border-t border-line pt-4">
            <ActionButton action={testPulseConnection} label="Verbinding testen (testbericht)" disabled={!c.pulse.url} />
            {c.pulse.lastTest && (
              <p className="text-xs text-ink-soft">
                Laatste test {fmtDateTime(new Date(c.pulse.lastTest.at))}: {c.pulse.lastTest.ok ? "gelukt" : "mislukt"} — {c.pulse.lastTest.message}
              </p>
            )}
            <details className="text-xs text-ink-soft">
              <summary className="cursor-pointer">Welke gegevens gaan naar Pulse?</summary>
              <pre className="mt-2 overflow-x-auto rounded-lg bg-cream p-3">{PULSE_EXAMPLE}</pre>
            </details>
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-white p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-sans text-lg font-semibold">AI tekst</h2>
              <p className="text-sm text-ink-soft">Voor AI-voorstellen van meta-descriptions in het beheer.</p>
            </div>
            <Status s={aiStatus} />
          </div>
          <SimpleForm action={saveAi}>
            <Field label="Provider">
              <select name="provider" defaultValue={c.ai.provider} className={input}>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic (Claude)</option>
              </select>
            </Field>
            <Field label="API-sleutel" hint={c.ai.keyHint ? `(opgeslagen: ${c.ai.keyHint} — leeg laten = ongewijzigd)` : ""}>
              <input name="apiKey" type="password" autoComplete="off" placeholder={c.ai.keyHint || "sk-…"} className={`${input} font-mono`} />
            </Field>
            <Field label="Tekstmodel" hint="(Anthropic: bv. claude-opus-5-5; OpenAI: een actueel model naar keuze)">
              <input name="model" list="ai-models" defaultValue={c.ai.model} className={`${input} font-mono`} />
              <datalist id="ai-models">
                {AI_MODELS.anthropic.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="enabled" defaultChecked={c.ai.enabled} /> Actief
            </label>
          </SimpleForm>
          <div className="mt-4 space-y-2 border-t border-line pt-4">
            <ActionButton action={testAiConnection} label="Verbinding testen (korte testvraag)" disabled={!c.ai.keyEnc} />
            {c.ai.lastTest && (
              <p className="text-xs text-ink-soft">
                Laatste test {fmtDateTime(new Date(c.ai.lastTest.at))}: {c.ai.lastTest.ok ? "gelukt" : "mislukt"} — {c.ai.lastTest.message}
              </p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-white p-6 lg:col-span-2">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-sans text-lg font-semibold">AI Foto — ChatGPT Images (OpenAI)</h2>
              <p className="text-sm text-ink-soft">
                Maakt in de pas-tool “Upload jezelf 🙂” automatisch een foto van de bezoeker in de jurk of het pak, op basis van een foto van het hoofd of het hele lichaam. Zonder actieve connectie valt de pas-tool terug op handmatig plaatsen.
              </p>
            </div>
            <Status s={aiImageStatus} />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <SimpleForm action={saveAiImage}>
              <Field label="OpenAI API-sleutel" hint={c.aiImage.keyHint ? `(opgeslagen: ${c.aiImage.keyHint} — leeg laten = ongewijzigd)` : "(platform.openai.com → API keys)"}>
                <input name="apiKey" type="password" autoComplete="off" placeholder={c.aiImage.keyHint || "sk-…"} className={`${input} font-mono`} />
              </Field>
              <Field label="Model" hint="(Images 2.5: flare = snel, sunburst = hoogste kwaliteit)">
                <input name="model" list="image-models" defaultValue={c.aiImage.model} className={`${input} font-mono`} />
                <datalist id="image-models">
                  {IMAGE_MODELS.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </Field>
              <Field label="Kwaliteit" hint="(hoger = mooier, maar trager en duurder)">
                <select name="quality" defaultValue={c.aiImage.quality} className={input}>
                  <option value="low">Laag (snelst)</option>
                  <option value="medium">Gemiddeld</option>
                  <option value="high">Hoog</option>
                </select>
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="enabled" defaultChecked={c.aiImage.enabled} /> Actief in de pas-tool
              </label>
            </SimpleForm>
            <div className="space-y-3 rounded-xl bg-cream p-4 text-sm text-ink-soft">
              <p className="font-medium text-ink">Zo werkt het</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>De bezoeker geeft eerst toestemming en uploadt een selfie of een foto van top tot teen.</li>
                <li>De foto gaat (verkleind) via onze server naar OpenAI, samen met de productfoto. Er wordt niets bewaard.</li>
                <li>Na 20–60 seconden verschijnt de foto, die de bezoeker kan bewaren of via WhatsApp delen.</li>
                <li>Maximaal 8 foto&apos;s per bezoeker per uur (bescherming tegen misbruik en kosten).</li>
              </ul>
              <ActionButton action={testAiImageConnection} label="Verbinding testen (sleutel en model controleren)" disabled={!c.aiImage.keyEnc} />
              {c.aiImage.lastTest && (
                <p className="text-xs">
                  Laatste test {fmtDateTime(new Date(c.aiImage.lastTest.at))}: {c.aiImage.lastTest.ok ? "gelukt" : "mislukt"} — {c.aiImage.lastTest.message}
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
