import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteAppointment, updateAppointment } from "@/app/admin/actions/manage";
import { DeleteButton } from "@/components/admin/fields";
import { SimpleForm } from "@/components/admin/SimpleForm";
import { Field, PageHeader, Panel, fmtDateTime, input } from "@/components/admin/ui";
import { can, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { strings } from "@/lib/json";
import { getAppointmentSettings } from "@/lib/settings";

export const metadata = { title: "Afspraak" };

export default async function AppointmentDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const a = await db.appointment.findUnique({ where: { id: (await params).id }, include: { product: true } });
  if (!a) notFound();
  const settings = await getAppointmentSettings();
  const favs = strings(a.favorites);
  const favProducts = favs.length ? await db.product.findMany({ where: { path: { in: favs } }, select: { path: true, name: true } }) : [];
  const type = settings.types.find((t) => t.key === a.type);
  const rows: [string, React.ReactNode][] = [
    ["Soort", type?.label ?? a.type],
    ["Naam", a.name],
    ["E-mail", <a key="e" href={`mailto:${a.email}`} className="underline">{a.email}</a>],
    ["Telefoon", <a key="t" href={`tel:${a.phone.replace(/\s/g, "")}`} className="underline">{a.phone}</a>],
    ["Trouwdatum", a.weddingDate ?? "–"],
    ["Gezelschap", `${a.companions} ${a.companions === 1 ? "persoon" : "personen"}`],
    ["Budget", a.budget ?? "–"],
    ["Wensen", a.notes ?? "–"],
    ["Vanaf product", a.product ? <Link key="p" href={a.product.path} target="_blank" className="underline">{a.product.name}</Link> : "–"],
    ["Bron", a.source ?? "website"],
    ["Aangevraagd", fmtDateTime(a.createdAt)],
  ];
  return (
    <>
      <PageHeader title={`Afspraak ${a.name}`} description={`${type?.label ?? a.type} · ${a.date} om ${a.time}`} action={<Link href="/admin/afspraken/" className="text-sm underline">← Alle afspraken</Link>} />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Panel title="Gegevens">
            <dl className="divide-y divide-line text-sm">
              {rows.map(([k, v]) => (
                <div key={k} className="grid grid-cols-[140px_1fr] gap-4 py-2.5">
                  <dt className="text-ink-soft">{k}</dt>
                  <dd className="whitespace-pre-line">{v}</dd>
                </div>
              ))}
            </dl>
          </Panel>
          {favs.length > 0 && (
            <Panel title="Favorieten van de klant (klaarzetten)">
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {favs.map((f) => (
                  <li key={f}>
                    <Link href={f} target="_blank" className="underline">
                      {favProducts.find((p) => p.path === f)?.name ?? f}
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
        <div className="space-y-6">
          <Panel title="Status en planning">
            <SimpleForm action={updateAppointment.bind(null, a.id)} readOnly={!can(user, "editor")}>
              <Field label="Status">
                <select name="status" defaultValue={a.status} className={input}>
                  <option value="nieuw">Nieuw</option>
                  <option value="bevestigd">Bevestigd</option>
                  <option value="afgerond">Afgerond</option>
                  <option value="geannuleerd">Geannuleerd</option>
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Datum">
                  <input type="date" name="date" defaultValue={a.date} className={input} />
                </Field>
                <Field label="Tijd">
                  <input type="time" name="time" defaultValue={a.time} className={input} />
                </Field>
              </div>
              <Field label="Interne notitie">
                <textarea name="internalNote" defaultValue={a.internalNote ?? ""} rows={4} className={input} />
              </Field>
            </SimpleForm>
          </Panel>
          <a href={`mailto:${a.email}?subject=${encodeURIComponent(`Je pasafspraak bij de Honeymoon shop op ${a.date} om ${a.time}`)}`} className="block rounded-2xl border border-line bg-white p-4 text-center text-sm hover:border-ink">
            E-mail de klant
          </a>
          {can(user, "editor") && <DeleteButton action={deleteAppointment.bind(null, a.id)} label="Afspraak verwijderen" />}
        </div>
      </div>
    </>
  );
}
