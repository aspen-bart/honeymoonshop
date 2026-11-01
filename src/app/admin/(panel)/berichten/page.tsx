import Link from "next/link";
import { deleteMessage, toggleMessage } from "@/app/admin/actions/manage";
import { DataTable, PER_PAGE, readParams, type Column } from "@/components/admin/DataTable";
import { DeleteButton } from "@/components/admin/fields";
import { Badge, Notice, PageHeader, btnSm, fmtDateTime } from "@/components/admin/ui";
import { can, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import type { ContactMessage } from "@prisma/client";

export const metadata = { title: "Berichten" };

export default async function MessagesAdmin({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const params = readParams(sp, { sort: "createdAt" }, ["status"]);
  const where = {
    ...(params.q ? { OR: [{ name: { contains: params.q } }, { email: { contains: params.q } }, { message: { contains: params.q } }, { subject: { contains: params.q } }] } : {}),
    ...(params.filters.status ? { handled: params.filters.status === "afgehandeld" } : {}),
  };
  const orderBy = { [["createdAt", "name"].includes(params.sort) ? params.sort : "createdAt"]: params.dir };
  const [rows, total] = await Promise.all([db.contactMessage.findMany({ where, orderBy, skip: (params.page - 1) * PER_PAGE, take: PER_PAGE }), db.contactMessage.count({ where })]);
  const editor = can(user, "editor");
  const cols: Column<ContactMessage>[] = [
    {
      key: "name",
      label: "Afzender",
      sortable: true,
      render: (r) => (
        <div>
          <p className="font-medium">{r.name}</p>
          <a href={`mailto:${r.email}`} className="text-xs underline">
            {r.email}
          </a>
          {r.phone && <p className="text-xs text-ink-soft">{r.phone}</p>}
        </div>
      ),
    },
    {
      key: "message",
      label: "Bericht",
      render: (r) => (
        <div className="max-w-xl">
          {r.subject && <p className="font-medium">{r.subject}</p>}
          <p className="whitespace-pre-line text-ink-2">{r.message}</p>
          {r.about && (
            <Link href={r.about} target="_blank" className="text-xs underline">
              Over: {r.about}
            </Link>
          )}
        </div>
      ),
    },
    { key: "createdAt", label: "Ontvangen", sortable: true, render: (r) => fmtDateTime(r.createdAt) },
    {
      key: "handled",
      label: "Status",
      render: (r) => (
        <div className="flex flex-col items-start gap-2">
          <Badge tone={r.handled ? "neutral" : "warning"}>{r.handled ? "afgehandeld" : "open"}</Badge>
          {editor && (
            <form action={toggleMessage.bind(null, r.id)}>
              <button className={btnSm}>{r.handled ? "Heropenen" : "Afhandelen"}</button>
            </form>
          )}
          {editor && <DeleteButton action={deleteMessage.bind(null, r.id)} label="Verwijderen" />}
        </div>
      ),
    },
  ];
  return (
    <>
      <PageHeader title="Berichten" description="Contactformulier, vragen over producten, Look Book-aanvragen en ingestuurde verhalen." />
      {sp.verwijderd && <Notice>Bericht verwijderd.</Notice>}
      <DataTable base="/admin/berichten/" params={params} columns={cols} rows={rows} total={total} searchLabel="Zoek in naam, e-mail of bericht" filters={[{ name: "status", label: "Status", options: [{ value: "open", label: "Open" }, { value: "afgehandeld", label: "Afgehandeld" }] }]} />
    </>
  );
}
