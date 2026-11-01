import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { SESSION_COOKIE, SESSION_HOURS, signSession, verifySession, type SessionPayload } from "./session";

// Rollen (tabel Role): admin = beheerder (alles), editor = redacteur (content en afspraken), viewer = alleen-lezen.
export type RoleKey = "admin" | "editor" | "viewer";
const RANK: Record<string, number> = { viewer: 1, editor: 2, admin: 3 };

export type AdminUser = { id: string; email: string; name: string; role: RoleKey; roleName: string };

export async function currentUser(): Promise<AdminUser | null> {
  const store = await cookies();
  const session = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  // Rechten altijd uit de database (een gewijzigde of verwijderde gebruiker verliest direct zijn rechten)
  const user = await db.user.findUnique({ where: { id: session.sub }, include: { role: true } });
  return user ? { id: user.id, email: user.email, name: user.name, role: user.role.key as RoleKey, roleName: user.role.name } : null;
}

/** Voor pagina's: niet ingelogd → login, te weinig rechten → dashboard. */
export async function requireUser(min: RoleKey = "viewer") {
  const user = await currentUser();
  if (!user) redirect("/admin/login/");
  if (RANK[user.role] < RANK[min]) redirect("/admin/?geen-toegang=1");
  return user;
}

/** Voor server actions: gooit een fout bij onvoldoende rechten (wordt als melding getoond). */
export async function assertRole(min: RoleKey) {
  const user = await currentUser();
  if (!user) throw new Error("Je sessie is verlopen. Log opnieuw in.");
  if (RANK[user.role] < RANK[min]) throw new Error("Je hebt geen rechten voor deze actie.");
  return user;
}

export const can = (user: AdminUser, min: RoleKey) => RANK[user.role] >= RANK[min];

export async function startSession(user: SessionPayload) {
  const token = await signSession(user);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_HOURS * 3600 });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}
