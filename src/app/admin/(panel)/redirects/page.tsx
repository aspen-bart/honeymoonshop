import { deleteRedirect, saveRedirect } from "@/app/admin/actions/manage";
import { DataTable, PER_PAGE, readParams, type Column } from "@/components/admin/DataTable";
import { SimpleForm } from "@/components/admin/SimpleForm";
import { Field, PageHeader, Panel, btnSm, fmtDate, input } from "@/components/admin/ui";
import { can, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { like } from "@/lib/search";
import type { Redirect } from "@prisma/client";

export const metadata = { title: "Redirects" };

export default async function RedirectsAdmin({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const params = readParams(await searchParams, { sort: "createdAt" });
  const where = params.q ? { OR: [{ from: like(params.q) }, { to: like(params.q) }] } : {};
  const [rows, total] = await Promise.all([db.redirect.findMany({ where, orderBy: { [["from", "createdAt"].includes(params.sort) ? params.sort : "createdAt"]: params.dir }, skip: (params.page - 1) * PER_PAGE, take: PER_PAGE }), db.redirect.count({ where })]);
  const editor = can(user, "editor");
  const cols: Column<Redirect>[] = [
    { key: "from", label: "Oud pad", sortable: true, render: (r) => <span className="font-mono text-xs">{r.from}</span> },
    { key: "to", label: "Nieuw pad", render: (r) => <span className="font-mono text-xs">{r.to}</span> },
    { key: "status", label: "Type", render: (r) => r.status },
    { key: "createdAt", label: "Sinds", sortable: true, render: (r) => fmtDate(r.createdAt) },
    {
      key: "actions",
      label: "",
      render: (r) =>
        editor && (
          <form action={deleteRedirect.bind(null, r.id)}>
            <button className={btnSm}>Verwijderen</button>
          </form>
        ),
    },
  ];
  return (
    <>
      <PageHeader title="Redirects" description="301-doorverwijzingen van oude naar nieuwe URL's. Wijzig je een URL-pad in het beheer, dan wordt hier automatisch een redirect toegevoegd." />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <DataTable base="/admin/redirects/" params={params} columns={cols} rows={rows} total={total} searchLabel="Zoek pad" />
        {editor && (
          <Panel title="Nieuwe redirect">
            <SimpleForm action={saveRedirect}>
              <Field label="Oud pad">
                <input name="from" placeholder="/oude-pagina/" required className={`${input} font-mono`} />
              </Field>
              <Field label="Nieuw pad of URL">
                <input name="to" placeholder="/nieuwe-pagina/" required className={`${input} font-mono`} />
              </Field>
              <Field label="Type">
                <select name="status" className={input}>
                  <option value="301">301 – permanent</option>
                  <option value="302">302 – tijdelijk</option>
                </select>
              </Field>
            </SimpleForm>
          </Panel>
        )}
      </div>
    </>
  );
}
