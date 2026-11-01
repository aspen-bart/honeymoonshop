import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

// og:image op 1200×630: snijdt een upload bij (/og/<naam>.jpg ↔ /uploads/<naam>.webp). default.jpg = campagnebeeld.
const DEFAULT = "limited_07_s8_a270927-1780585254-e1786357080767-1536x855";

export async function GET(_: Request, { params }: { params: Promise<{ file: string }> }) {
  const name = (await params).file.replace(/\.jpg$/, "");
  if (!/^[a-z0-9._-]+$/i.test(name)) return new Response("Niet gevonden", { status: 404 });
  const src = path.join(process.cwd(), "public", "uploads", `${name === "default" ? DEFAULT : name}.webp`);
  try {
    const out = await sharp(await fs.readFile(src)).resize(1200, 630, { fit: "cover", position: "attention" }).jpeg({ quality: 82 }).toBuffer();
    return new Response(new Uint8Array(out), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=604800, immutable" } });
  } catch {
    return new Response("Niet gevonden", { status: 404 });
  }
}
