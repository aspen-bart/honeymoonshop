import "server-only";
import { revalidatePath } from "next/cache";
import { db } from "../db";

export const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
export const opt = (f: FormData, k: string) => str(f, k) || null;
export const num = (f: FormData, k: string) => {
  const v = str(f, k).replace(",", ".");
  return v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null;
};
export const bool = (f: FormData, k: string) => f.get(k) === "on" || f.get(k) === "true";
export const statusOf = (f: FormData) => (str(f, "status") === "draft" ? "draft" : "published");

/** URL-pad valideren: kleine letters, koppeltekens, slash aan begin en eind. */
export function normalizePath(p: string) {
  let v = p.trim().toLowerCase().replace(/\s+/g, "-");
  if (!v.startsWith("/")) v = `/${v}`;
  if (!v.endsWith("/")) v += "/";
  return /^\/([a-z0-9-]+\/)*$/.test(v) ? v : null;
}

/** Is dit pad al in gebruik door andere content? */
export async function pathTaken(path: string, except?: { table: string; id: string }) {
  const checks = await Promise.all([
    db.page.findFirst({ where: { path }, select: { id: true } }).then((r) => r && { table: "page", id: r.id }),
    db.product.findFirst({ where: { path }, select: { id: true } }).then((r) => r && { table: "product", id: r.id }),
    db.category.findFirst({ where: { path }, select: { id: true } }).then((r) => r && { table: "category", id: r.id }),
    db.post.findFirst({ where: { path }, select: { id: true } }).then((r) => r && { table: "post", id: r.id }),
    db.review.findFirst({ where: { path }, select: { id: true } }).then((r) => r && { table: "review", id: r.id }),
  ]);
  return checks.some((c) => c && !(except && c.table === except.table && c.id === except.id));
}

/** Pad gewijzigd? Dan automatisch een 301 van oud naar nieuw (SEO behouden). */
export async function redirectOnMove(oldPath: string | undefined, newPath: string) {
  if (!oldPath || oldPath === newPath) return;
  await db.redirect.deleteMany({ where: { from: newPath } });
  await db.redirect.upsert({ where: { from: oldPath }, create: { from: oldPath, to: newPath }, update: { to: newPath } });
  await db.redirect.updateMany({ where: { to: oldPath }, data: { to: newPath } });
}

/** Publieke pagina's opnieuw laten renderen na een wijziging. */
export function refresh(...paths: (string | null | undefined)[]) {
  for (const p of paths) if (p) revalidatePath(p);
  revalidatePath("/", "layout");
}

/** Date → waarde voor <input type="datetime-local"> (lokale tijd). */
export const localInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
