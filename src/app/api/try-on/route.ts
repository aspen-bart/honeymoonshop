import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { aiTryOn } from "@/lib/ai";
import { db } from "@/lib/db";
import { images } from "@/lib/json";
import { rateLimit } from "@/lib/rate-limit";

// AI-weergave van de pas-tool. De foto wordt alleen doorgestuurd naar de AI-dienst en nergens opgeslagen.
export async function POST(req: Request) {
  if (!(await rateLimit("try-on", 8, 60 * 60 * 1000))) return NextResponse.json({ error: "Je hebt het maximum aantal AI-looks voor dit uur bereikt. Probeer het later opnieuw." }, { status: 429 });
  const form = await req.formData();
  const photo = form.get("photo");
  const productPath = String(form.get("product") ?? "");
  const imageSrc = String(form.get("image") ?? "");
  const mode = form.get("mode") === "head" ? "head" : "body";
  if (!(photo instanceof Blob) || photo.size > 6 * 1024 * 1024 || !photo.type.startsWith("image/")) return NextResponse.json({ error: "Ongeldige foto." }, { status: 400 });
  const product = await db.product.findFirst({ where: { path: productPath, status: "published", kind: { in: ["dress", "suit"] } } });
  if (!product) return NextResponse.json({ error: "Product niet gevonden." }, { status: 404 });
  const src = images(product.images).find((i) => i.src === imageSrc)?.src ?? images(product.images)[0]?.src;
  if (!src?.startsWith("/uploads/")) return NextResponse.json({ error: "Geen productfoto beschikbaar." }, { status: 400 });
  try {
    const garment = new Blob([await fs.readFile(path.join(process.cwd(), "public", src))], { type: "image/webp" });
    const image = await aiTryOn(photo, garment, product.kind, mode);
    return NextResponse.json({ image });
  } catch (e) {
    // Technische details (bv. van OpenAI) alleen in het serverlog; de bezoeker krijgt een vriendelijke melding.
    console.error("[try-on]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Het maken van je AI-foto lukte nu even niet." }, { status: 502 });
  }
}
