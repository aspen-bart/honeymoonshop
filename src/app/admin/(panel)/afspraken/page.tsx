import Link from "next/link";
import { DataTable, PER_PAGE, readParams, type Column } from "@/components/admin/DataTable";
import { Badge, Notice, PageHeader, fmtDateTime } from "@/components/admin/ui";
import { todayNl } from "@/lib/appointments";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { like } from "@/lib/search";
import { getAppointmentSettings } from "@/lib/settings";
import type { Appointment } from "@prisma/client";

export const metadata = { title: "Afspraken" };

const STATUS_TONE = { nieuw: "warning", bevestigd: "success", afgerond: "neutral", geannuleerd: "danger" } as const;

export default async function AppointmentsAdmin({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireUser();
  const sp = await searchParams;
  const params = readParams(sp, { sort: "date", dir: "asc" }, ["status", "soort", "periode"]);
  const today = todayNl();
  const where = {
    ...(params.q ? { OR: [{ name: like(params.q) }, { email: like(params.q) }, { phone: like(params.q) }, { date: like(params.q) }] } : {}),
    ...(params.filters.status ? { status: params.filters.status } : {}),
    ...(params.filters.soort ? { type: params.filters.soort } : {}),
    ...(params.filters.periode === "komend" ? { date: { gte: today } } : params.filters.periode === "verleden" ? { date: { lt: today } } : {}),
  };
  const sortKey = ["date", "createdAt", "name", "status"].includes(params.sort) ? params.sort : "date";
  const orderBy = sortKey === "date" ? [{ date: params.dir }, { time: params.dir }] : [{ [sortKey]: params.dir }];
  const [rows, total, settings] = await Promise.all([db.appointment.findMany({ where, orderBy, skip: (params.page - 1) * PER_PAGE, take: PER_PAGE }), db.appointment.count({ where }), getAppointmentSettings()]);
  const label = (k: string) => settings.types.find((t) => t.key === k)?.label ?? k;
  const cols: Column<Appointment>[] = [
    {
      key: "date",
      label: "Moment",
      sortable: true,
      render: (r) => (
        <Link href={`/admin/afspraken/${r.id}/`} className="font-medium hover:underline">
          {new Intl.DateTimeFormat("nl-NL", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${r.date}T12:00:00Z`))} · {r.time}
        </Link>
      ),
    },
    {
      key: "name",
      label: "Klant",
      sortable: true,
      render: (r) => (
        <div>
          <p>{r.name}</p>
          <p className="text-xs text-ink-soft">
            {r.email} · {r.phone}
          </p>
        </div>
      ),
    },
    { key: "type", label: "Soort", render: (r) => label(r.type) },
    { key: "status", label: "Status", sortable: true, render: (r) => <Badge tone={STATUS_TONE[r.status as keyof typeof STATUS_TONE] ?? "neutral"}>{r.status}</Badge> },
    { key: "createdAt", label: "Aangevraagd", sortable: true, render: (r) => fmtDateTime(r.createdAt) },
  ];
  return (
    <>
      <PageHeader title="Afspraken" description="Alle pasafspraken uit de online planner. Bevestig nieuwe aanvragen en houd de agenda bij." />
      {sp.verwijderd && <Notice>Afspraak verwijderd.</Notice>}
      <DataTable
        base="/admin/afspraken/"
        params={params}
        columns={cols}
        rows={rows}
        total={total}
        searchLabel="Zoek op naam, e-mail, telefoon of datum (2026-11-20)"
        filters={[
          { name: "periode", label: "Periode", options: [{ value: "komend", label: "Komend" }, { value: "verleden", label: "Verleden" }] },
          { name: "status", label: "Status", options: ["nieuw", "bevestigd", "afgerond", "geannuleerd"].map((s) => ({ value: s, label: s })) },
          { name: "soort", label: "Soort", options: settings.types.map((t) => ({ value: t.key, label: t.label })) },
        ]}
      />
    </>
  );
}
