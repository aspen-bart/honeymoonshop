import { NextResponse } from "next/server";
import { availability } from "@/lib/appointments";

// GET /api/appointments/slots/?type=trouwjurk&from=2026-11-01&to=2026-11-30
export async function GET(req: Request) {
  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? "";
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return NextResponse.json({ error: "Ongeldige periode" }, { status: 400 });
  return NextResponse.json({ days: await availability(type, from, to) }, { headers: { "Cache-Control": "no-store" } });
}

export const dynamic = "force-dynamic";
