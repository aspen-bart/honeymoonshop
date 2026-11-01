import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { images } from "@/lib/json";

// Kleine productkaart voor formulieren die een product meekrijgen via ?product= of ?over= (afspraak, contact).
export async function GET(req: Request) {
  const path = new URL(req.url).searchParams.get("path") ?? "";
  const p = await db.product.findFirst({ where: { path, status: "published" }, select: { path: true, name: true, images: true, kind: true } });
  if (!p) return NextResponse.json(null, { status: 404 });
  return NextResponse.json({ path: p.path, name: p.name, kind: p.kind, image: images(p.images)[0]?.src ?? null });
}
