import { AdminNav } from "@/components/admin/AdminNav";
import { TicketButton } from "@/components/admin/TicketButton";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { logout } from "../actions/auth";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [appointments, messages, reviews, tickets] = await Promise.all([db.appointment.count({ where: { status: "nieuw" } }), db.contactMessage.count({ where: { handled: false } }), db.review.count({ where: { status: "draft" } }), db.ticket.count({ where: { status: { in: ["open", "in-behandeling"] } } })]);
  return (
    <div className="min-h-dvh lg:pl-64">
      <AdminNav user={user} counts={{ appointments, messages, reviews, tickets }} logout={logout} />
      <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-10">{children}</main>
      <TicketButton />
    </div>
  );
}
