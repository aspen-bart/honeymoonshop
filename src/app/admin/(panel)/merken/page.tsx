import { deleteBrand, saveBrand } from "@/app/admin/actions/content";
import { DataTable, PER_PAGE, readParams, type Column } from "@/components/admin/DataTable";
import { DeleteButton } from "@/components/admin/fields";
import { SimpleForm } from "@/components/admin/SimpleForm";
import { Field, Notice, PageHeader, Panel, input } from "@/components/admin/ui";
import { can, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Brand } from "@prisma/client";

export const metadata = { title: "Merken" };
const KIND: Record<string, string> = { dress: "Trouwjurken", suit: "Trouwpakken", accessory: "Accessoires" };

type Row = Brand & { _count: { products: number } };

export default async function BrandsAdmin({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const params = readParams(sp, { sort: "name", dir: "asc" }, ["soort"]);
  const where = { ...(params.q ? { name: { contains: params.q } } : {}), ...(params.filters.soort ? { kind: params.filters.soort } : {}) };
  const [rows, total] = await Promise.all([db.brand.findMany({ where, include: { _count: { select: { products: true } } }, orderBy: { name: params.dir }, skip: (params.page - 1) * PER_PAGE, take: PER_PAGE }), db.brand.count({ where })]);
  const editor = can(user, "editor");
  const edit = sp.bewerk ? await db.brand.findUnique({ where: { id: sp.bewerk } }) : null;
  const cols: Column<Row>[] = [
    {
      key: "name",
      label: "Merk",
      sortable: true,
      render: (r) => (
        <a href={`/admin/merken/?bewerk=${r.id}`} className="font-medium hover:underline">
          {r.name}
        </a>
      ),
    },
    { key: "kind", label: "Soort", render: (r) => KIND[r.kind] },
    { key: "slug", label: "Filter-URL", render: (r) => <span className="font-mono text-xs">{r.kind === "dress" ? `/trouwjurken/${r.slug}/` : r.kind === "suit" ? `/pakken/${r.slug}/` : "–"}</span> },
    { key: "products", label: "Producten", render: (r) => r._count.products },
  ];
  return (
    <>
      <PageHeader title="Merken" description="Merken van trouwjurken, trouwpakken en accessoires." />
      {sp.verwijderd && <Notice>Merk verwijderd.</Notice>}
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <DataTable base="/admin/merken/" params={params} columns={cols} rows={rows} total={total} searchLabel="Zoek merk" filters={[{ name: "soort", label: "Soort", options: Object.entries(KIND).map(([value, label]) => ({ value, label })) }]} />
        <div className="space-y-4">
          <Panel title={edit ? `Bewerk ${edit.name}` : "Nieuw merk"}>
            <SimpleForm action={saveBrand} readOnly={!editor} key={edit?.id ?? "new"}>
              {edit && <input type="hidden" name="id" value={edit.id} />}
              <Field label="Naam">
                <input name="name" defaultValue={edit?.name} required className={input} />
              </Field>
              <Field label="Soort">
                <select name="kind" defaultValue={edit?.kind ?? "dress"} className={input}>
                  {Object.entries(KIND).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Slug" hint="(leeg = uit de naam)">
                <input name="slug" defaultValue={edit?.slug} className={`${input} font-mono`} />
              </Field>
              <Field label="Logo" hint="(pad uit de mediabibliotheek)">
                <input name="logo" defaultValue={edit?.logo ?? ""} placeholder="/uploads/logo.webp" className={`${input} font-mono`} />
              </Field>
            </SimpleForm>
          </Panel>
          {edit && editor && <DeleteButton action={deleteBrand.bind(null, edit.id)} label="Merk verwijderen" confirmText="Merk verwijderen? Producten van dit merk blijven bestaan, zonder merk." />}
        </div>
      </div>
    </>
  );
}
