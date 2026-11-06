import Link from "next/link";
import { DataTable, PER_PAGE, readParams, type Column } from "@/components/admin/DataTable";
import { NewTicketButton } from "@/components/admin/TicketButton";
import { Badge, Notice, PageHeader, Stat, fmtDateTime } from "@/components/admin/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { like } from "@/lib/search";
import { TICKET_PRIO, TICKET_STATUS, TICKET_TYPE } from "@/lib/admin/tickets";
import { getConnections } from "@/lib/settings";
import type { Ticket } from "@prisma/client";

export const metadata = { title: "Tickets" };

export default async function TicketsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireUser();
  const sp = await searchParams;
  const params = readParams(sp, { sort: "number" }, ["status", "type", "prioriteit"]);
  const where = {
    ...(params.q ? { OR: [{ subject: like(params.q) }, { description: like(params.q) }] } : {}),
    ...(params.filters.status ? { status: params.filters.status } : {}),
    ...(params.filters.type ? { type: params.filters.type } : {}),
    ...(params.filters.prioriteit ? { priority: params.filters.prioriteit } : {}),
  };
  const orderBy = { [["number", "subject", "status", "priority", "updatedAt"].includes(params.sort) ? params.sort : "number"]: params.dir };
  const [rows, total, groups, conn] = await Promise.all([db.ticket.findMany({ where, orderBy, skip: (params.page - 1) * PER_PAGE, take: PER_PAGE }), db.ticket.count({ where }), db.ticket.groupBy({ by: ["status"], _count: { _all: true } }), getConnections()]);
  const count = (s: string) => groups.find((g) => g.status === s)?._count._all ?? 0;
  const cols: Column<Ticket>[] = [
    { key: "number", label: "#", sortable: true, className: "w-16", render: (r) => <span className="font-mono text-xs">#{r.number}</span> },
    {
      key: "subject",
      label: "Onderwerp",
      sortable: true,
      render: (r) => (
        <div>
          <Link href={`/admin/tickets/${r.id}/`} className="font-medium hover:underline">
            {r.subject}
          </Link>
          <p className="text-xs text-ink-soft">
            {TICKET_TYPE[r.type] ?? r.type} · {r.createdByName}
          </p>
        </div>
      ),
    },
    { key: "priority", label: "Prioriteit", sortable: true, render: (r) => <Badge tone={TICKET_PRIO[r.priority]?.tone}>{TICKET_PRIO[r.priority]?.label ?? r.priority}</Badge> },
    { key: "status", label: "Status", sortable: true, render: (r) => <Badge tone={TICKET_STATUS[r.status]?.tone}>{TICKET_STATUS[r.status]?.label ?? r.status}</Badge> },
    { key: "pulse", label: "Pulse", render: (r) => (r.pulseSyncedAt ? <Badge tone="success">verstuurd</Badge> : r.pulseError ? <Badge tone="danger">mislukt</Badge> : <Badge>–</Badge>) },
    { key: "updatedAt", label: "Gewijzigd", sortable: true, render: (r) => fmtDateTime(r.updatedAt) },
  ];
  return (
    <>
      <PageHeader title="Tickets" description="Wijzigingsverzoeken, fouten en vragen over de website. Tickets gaan automatisch naar Pulse als die connectie aan staat." action={<NewTicketButton />} />
      {sp.verwijderd && <Notice>Ticket verwijderd.</Notice>}
      {!conn.pulse.enabled && (
        <p className="mb-5 rounded-xl bg-cream px-4 py-3 text-sm text-ink-soft">
          De Pulse-connectie staat uit: tickets worden alleen hier bewaard. <Link href="/admin/connecties/#pulse" className="underline">Pulse instellen</Link>
        </p>
      )}
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Open" value={count("open")} href="/admin/tickets/?status=open" />
        <Stat label="In behandeling" value={count("in-behandeling")} href="/admin/tickets/?status=in-behandeling" />
        <Stat label="Wacht op klant" value={count("wacht-op-klant")} href="/admin/tickets/?status=wacht-op-klant" />
        <Stat label="Opgelost / gesloten" value={count("opgelost") + count("gesloten")} />
      </div>
      <DataTable
        base="/admin/tickets/"
        params={params}
        columns={cols}
        rows={rows}
        total={total}
        searchLabel="Zoek in tickets"
        filters={[
          { name: "status", label: "Status", options: Object.entries(TICKET_STATUS).map(([value, v]) => ({ value, label: v.label })) },
          { name: "type", label: "Soort", options: Object.entries(TICKET_TYPE).map(([value, label]) => ({ value, label })) },
          { name: "prioriteit", label: "Prioriteit", options: Object.entries(TICKET_PRIO).map(([value, v]) => ({ value, label: v.label })) },
        ]}
      />
    </>
  );
}
