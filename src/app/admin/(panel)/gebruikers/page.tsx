import { deleteUser, saveUser } from "@/app/admin/actions/manage";
import { DeleteButton } from "@/components/admin/fields";
import { SimpleForm } from "@/components/admin/SimpleForm";
import { Badge, Field, Notice, PageHeader, Panel, fmtDateTime, input } from "@/components/admin/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata = { title: "Gebruikers" };

const RIGHTS: Record<string, string> = {
  admin: "Alles, inclusief gebruikers, connecties en instellingen",
  editor: "Content, producten, media en afspraken beheren",
  viewer: "Alles bekijken, niets wijzigen",
};

export default async function UsersAdmin({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const me = await requireUser("admin");
  const sp = await searchParams;
  const [users, roles] = await Promise.all([db.user.findMany({ include: { role: true }, orderBy: { name: "asc" } }), db.role.findMany({ orderBy: { name: "asc" } })]);
  const edit = sp.bewerk ? users.find((u) => u.id === sp.bewerk) : null;
  return (
    <>
      <PageHeader title="Gebruikers en rollen" description="Rollen staan in een eigen tabel; rechten worden bij elke actie op de server gecontroleerd." />
      {sp.opgeslagen && <Notice>Gebruiker opgeslagen.</Notice>}
      {sp.verwijderd && <Notice>Gebruiker verwijderd.</Notice>}
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="overflow-hidden rounded-2xl border border-line bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wider text-ink-soft">
              <tr>
                <th className="px-4 py-3 font-medium">Naam</th>
                <th className="px-4 py-3 font-medium">Rol</th>
                <th className="px-4 py-3 font-medium">Laatst ingelogd</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3">
                    <a href={`/admin/gebruikers/?bewerk=${u.id}`} className="font-medium hover:underline">
                      {u.name}
                    </a>
                    <p className="text-xs text-ink-soft">{u.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={u.role.key === "admin" ? "brand" : "neutral"}>{u.role.name}</Badge>
                  </td>
                  <td className="px-4 py-3">{fmtDateTime(u.lastLoginAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-line p-4 text-sm">
            <p className="mb-2 font-medium">Rollen</p>
            <ul className="space-y-1 text-ink-soft">
              {roles.map((r) => (
                <li key={r.id}>
                  <strong className="text-ink">{r.name}</strong>: {RIGHTS[r.key]}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="space-y-4">
          <Panel title={edit ? `Bewerk ${edit.name}` : "Nieuwe gebruiker"} action={edit && <a href="/admin/gebruikers/" className="text-xs underline">+ Nieuw</a>}>
            <SimpleForm action={saveUser.bind(null, edit?.id ?? null)} key={edit?.id ?? "new"}>
              <Field label="Naam">
                <input name="name" defaultValue={edit?.name} required className={input} />
              </Field>
              <Field label="E-mailadres">
                <input name="email" type="email" defaultValue={edit?.email} required className={input} autoComplete="off" />
              </Field>
              <Field label="Rol">
                <select name="roleId" defaultValue={edit?.roleId ?? roles.find((r) => r.key === "editor")?.id} className={input}>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={edit ? "Nieuw wachtwoord" : "Wachtwoord"} hint={edit ? "(leeg = ongewijzigd)" : "(min. 12 tekens)"}>
                <input name="password" type="password" autoComplete="new-password" className={input} />
              </Field>
            </SimpleForm>
          </Panel>
          {edit && edit.id !== me.id && <DeleteButton action={deleteUser.bind(null, edit.id)} label="Gebruiker verwijderen" />}
        </div>
      </div>
    </>
  );
}
