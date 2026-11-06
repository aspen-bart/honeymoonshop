import "server-only";
import type { Ticket } from "@prisma/client";
import { decrypt } from "./crypto";
import { SITE_URL, getConnections } from "./settings";

// Pulse-koppeling voor tickets. Elk ticket gaat als JSON (POST) naar de ingestelde Pulse-URL, met de
// API-sleutel als Bearer-token. Het id uit het antwoord (id, ticket_id of data.id) wordt bij het ticket bewaard.

export function ticketPayload(t: Ticket, projectId: string) {
  return {
    source: "honeymoonshop-admin",
    project: projectId || undefined,
    reference: `HMS-${t.number}`,
    subject: t.subject,
    description: t.description,
    type: t.type,
    priority: t.priority,
    status: t.status,
    url: t.pageUrl ? (t.pageUrl.startsWith("http") ? t.pageUrl : `${SITE_URL}${t.pageUrl}`) : undefined,
    attachments: (JSON.parse(t.attachments || "[]") as string[]).map((a) => `${SITE_URL}${a}`),
    reporter: { name: t.createdByName, email: t.createdByEmail ?? undefined },
    createdAt: t.createdAt.toISOString(),
  };
}

export async function pushTicket(t: Ticket): Promise<{ id: string | null }> {
  const c = (await getConnections()).pulse;
  if (!c.enabled || !c.url) throw new Error("De Pulse-connectie staat uit.");
  const res = await fetch(c.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", ...(c.keyEnc ? { Authorization: `Bearer ${decrypt(c.keyEnc)}` } : {}) },
    body: JSON.stringify(ticketPayload(t, c.projectId)),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Pulse gaf status ${res.status}${res.status === 401 || res.status === 403 ? " (controleer de API-sleutel)" : ""}.`);
  const data = (await res.json().catch(() => ({}))) as { id?: string | number; ticket_id?: string | number; data?: { id?: string | number } };
  const id = data.id ?? data.ticket_id ?? data.data?.id;
  return { id: id != null ? String(id) : null };
}

/** Bereikbaarheid en sleutel testen met een testbericht (test: true), zonder echt ticket. */
export async function testPulse() {
  const c = (await getConnections()).pulse;
  if (!c.url) throw new Error("Vul eerst de Pulse-URL in.");
  const res = await fetch(c.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", ...(c.keyEnc ? { Authorization: `Bearer ${decrypt(c.keyEnc)}` } : {}) },
    body: JSON.stringify({ source: "honeymoonshop-admin", test: true, project: c.projectId || undefined, subject: "Verbindingstest vanuit het beheer" }),
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status === 401 || res.status === 403) throw new Error("Pulse weigert de API-sleutel.");
  if (!res.ok) throw new Error(`Pulse gaf status ${res.status}.`);
  return `Pulse bereikbaar (status ${res.status}).`;
}
