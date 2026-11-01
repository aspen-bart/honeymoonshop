// Downloadt alle afbeeldingen uit content/images.json naar public/uploads/ als WebP (max. 1600px).
// Bestaande bestanden worden overgeslagen, dus het script kan veilig opnieuw draaien.
// Gebruik: npm run images
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const map = JSON.parse(fs.readFileSync(path.join(root, "content", "images.json"), "utf8"));
const outDir = path.join(root, "public");
fs.mkdirSync(path.join(outDir, "uploads"), { recursive: true });

const entries = Object.entries(map).filter(([local]) => !fs.existsSync(path.join(outDir, local)));
console.log(`${Object.keys(map).length} afbeeldingen, ${entries.length} nog te downloaden`);

let done = 0;
const failed = [];
async function one([local, url]) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130 Safari/537.36" } });
      if (res.status === 404) throw Object.assign(new Error("404"), { final: true });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      await sharp(buf).rotate().resize({ width: 1600, height: 2000, fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toFile(path.join(outDir, local));
      return;
    } catch (e) {
      if (e.final || attempt === 3) {
        failed.push({ local, url, error: e.message });
        return;
      }
      await new Promise((r) => setTimeout(r, 10000 * attempt));
    }
  }
}

const queue = [...entries];
await Promise.all(
  Array.from({ length: 3 }, async () => {
    while (queue.length) {
      await one(queue.shift());
      if (++done % 100 === 0) console.log(`  ${done}/${entries.length}`);
    }
  }),
);
fs.writeFileSync(path.join(root, "content", "images-failed.json"), JSON.stringify(failed, null, 2));
console.log(`Klaar. ${failed.length} mislukt (zie content/images-failed.json)`);
