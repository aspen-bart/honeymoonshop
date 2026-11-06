import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteTicket, resendTicket, updateTicket } from "@/app/admin/actions/extra";
import { DeleteButton } from "@/components/admin/fields";
import { ActionButton, SimpleForm } from "@/components/admin/SimpleForm";
import { Badge, Field, PageHeader, Panel, btnSm, fmtDateTime, input } from "@/components/admin/ui";
import { TICKET_PRIO, TICKET_STATUS, TICKET_TYPE } from "@/lib/admin/tickets";
import { can, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { strings } from "@/lib/json";
import { getConnections } from "@/lib/settings";

export const metadata = { title: "Ticket" };

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const [t, conn] = await Promise.all([db.ticket.findUnique({ where: { id } }), getConnections()]);
  if (!t) notFound();
  const files = strings(t.attachments);
  return (
    <>
      <PageHeader
        title={`#${t.number} · ${t.subject}`}
        description={`${TICKET_TYPE[t.type] ?? t.type} · ingediend door ${t.createdByName} op ${fmtDateTime(t.createdAt)}`}
        action={
          <Link href="/admin/tickets/" className={btnSm}>
            ← Alle tickets
          </Link>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Panel title="Omschrijving">
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{t.description}</p>
            {t.pageUrl && (
              <p className="mt-4 text-sm">
                Pagina:{" "}
                <a href={t.pageUrl} target="_blank" className="font-mono text-xs underline">
                  {t.pageUrl}
                </a>
              </p>
            )}
          </Panel>
          {files.length > 0 && (
            <Panel title="Screenshots">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {files.map((f) => (
                  <a key={f} href={f} target="_blank" className="block overflow-hidden rounded-xl border border-line">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f} alt="Screenshot bij het ticket" className="aspect-video w-full object-cover" />
                  </a>
                ))}
              </div>
            </Panel>
          )}
        </div>
        <aside className="space-y-6">
          <Panel title="Afhandeling">
            <SimpleForm action={updateTicket.bind(null, t.id)} readOnly={!can(user, "editor")}>
              <Field label="Status">
                <select name="status" defaultValue={t.status} className={input}>
                  {Object.entries(TICKET_STATUS).map(([v, s]) => (
                    <option key={v} value={v}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Prioriteit">
                <select name="priority" defaultValue={t.priority} className={input}>
                  {Object.entries(TICKET_PRIO).map(([v, s]) => (
                    <option key={v} value={v}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Interne notitie">
                <textarea name="internalNote" defaultValue={t.internalNote ?? ""} rows={4} className={input} />
              </Field>
            </SimpleForm>
          </Panel>
          <Panel title="Pulse">
            <div className="space-y-3 text-sm">
              {t.pulseSyncedAt ? (
                <p>
                  <Badge tone="success">verstuurd</Badge> op {fmtDateTime(t.pulseSyncedAt)}
                  {t.pulseId && t.pulseId !== "verstuurd" && <span className="block font-mono text-xs text-ink-soft">Pulse-id: {t.pulseId}</span>}
                </p>
              ) : t.pulseError ? (
                <p className="text-danger">Niet verstuurd: {t.pulseError}</p>
              ) : (
                <p className="text-ink-soft">Nog niet naar Pulse verstuurd{conn.pulse.enabled ? "." : " (connectie staat uit)."}</p>
              )}
              {can(user, "editor") && <ActionButton action={resendTicket.bind(null, t.id)} label={t.pulseSyncedAt ? "Opnieuw versturen" : "Naar Pulse versturen"} disabled={!conn.pulse.enabled} />}
            </div>
          </Panel>
          {can(user, "admin") && <DeleteButton action={deleteTicket.bind(null, t.id)} label="Ticket verwijderen" />}
        </aside>
      </div>
    </>
  );
}
