import { AdminNav } from "@/components/admin/AdminNav";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { logout } from "../actions/auth";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [appointments, messages, reviews] = await Promise.all([db.appointment.count({ where: { status: "nieuw" } }), db.contactMessage.count({ where: { handled: false } }), db.review.count({ where: { status: "draft" } })]);
  return (
    <div className="min-h-dvh lg:pl-64">
      <AdminNav user={user} counts={{ appointments, messages, reviews }} logout={logout} />
      <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-10">{children}</main>
    </div>
  );
}
