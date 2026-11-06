import { NextResponse } from "next/server";
import { audit } from "@/lib/admin/audit";
import { EXPORT_TYPES, exportAll, exportItems, toCsv, type ExportType } from "@/lib/admin/transfer";
import { currentUser } from "@/lib/auth";

// Download van een export: /api/admin/export/?type=posts&format=json|csv, of ?type=full (alles, JSON).
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? "";
  const format = url.searchParams.get("format") === "csv" ? "csv" : "json";
  const stamp = new Date().toISOString().slice(0, 10);
  const sensitive = ["appointments", "messages", "full"].includes(type);
  if (sensitive && user.role === "viewer") return NextResponse.json({ error: "Geen rechten" }, { status: 403 });

  if (type === "full") {
    if (user.role !== "admin") return NextResponse.json({ error: "Alleen beheerders" }, { status: 403 });
    const body = JSON.stringify(await exportAll(), null, 2);
    await audit(user, "geëxporteerd", "Export", null, "Volledige back-up (JSON)");
    return new NextResponse(body, { headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="honeymoonshop-backup-${stamp}.json"` } });
  }
  if (!(type in EXPORT_TYPES)) return NextResponse.json({ error: "Onbekend type" }, { status: 400 });
  const items = await exportItems(type as ExportType);
  await audit(user, "geëxporteerd", "Export", null, `${EXPORT_TYPES[type as ExportType].label} (${format.toUpperCase()}, ${items.length} regels)`);
  const name = `honeymoonshop-${type}-${stamp}.${format}`;
  if (format === "csv") return new NextResponse(toCsv(items), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"` } });
  const body = JSON.stringify({ format: "honeymoonshop-export", version: 1, type, exportedAt: new Date().toISOString(), count: items.length, items }, null, 2);
  return new NextResponse(body, { headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"` } });
}
