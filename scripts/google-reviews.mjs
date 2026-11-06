// Haalt de Google-reviews uit de opgeslagen pagina's van de oude site (Trustindex-widget) en schrijft
// content/google-reviews.json: naam, sterren, tekst en profielfoto. De profielfoto's worden lokaal opgeslagen
// in public/uploads/reviews/ (geen externe verzoeken naar Google vanuit de bezoeker zijn browser).
// Gebruik: node scripts/google-reviews.mjs (na npm run scrape)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const raw = path.join(root, "scripts", "raw");
const outDir = path.join(root, "public", "uploads", "reviews");
fs.mkdirSync(outDir, { recursive: true });

const slug = (s) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const seen = new Map();
for (const f of fs.readdirSync(raw).filter((x) => x.endsWith(".html"))) {
  const html = fs.readFileSync(path.join(raw, f), "utf8");
  if (!html.includes("ti-review-item")) continue;
  const $ = cheerio.load(html);
  $(".ti-review-item.source-Google").each((_, el) => {
    const name = $(el).find(".ti-name").first().text().replace(/\s+/g, " ").trim();
    const text = $(el).find(".ti-review-text-container").first().text().replace(/\s+/g, " ").trim();
    const stars = $(el).find("img.ti-star[src*='/star/f.svg']").length;
    const img = $(el).find(".ti-profile-img img").first();
    const photo = img.attr("data-src") || img.attr("src") || "";
    if (!name || !text) return;
    const key = `${name}|${text.slice(0, 40)}`;
    if (!seen.has(key)) seen.set(key, { name, stars, text, photo: /googleusercontent\.com/.test(photo) ? photo : "" });
    else if (!seen.get(key).photo && /googleusercontent\.com/.test(photo)) seen.get(key).photo = photo;
  });
}

const reviews = [];
for (const r of seen.values()) {
  let avatar = null;
  if (r.photo) {
    // grotere versie opvragen (de widget gebruikt 40/80 px), daarna lokaal als WebP bewaren
    const url = r.photo.replace(/=w\d+-h\d+/, "=w160-h160");
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const file = `${slug(r.name)}.webp`;
      await sharp(Buffer.from(await res.arrayBuffer())).resize(160, 160, { fit: "cover" }).webp({ quality: 82 }).toFile(path.join(outDir, file));
      avatar = `/uploads/reviews/${file}`;
    } catch (e) {
      console.warn(`Geen foto voor ${r.name}: ${e.message}`);
    }
  }
  reviews.push({ name: r.name, stars: r.stars, text: r.text, avatar });
}
fs.writeFileSync(path.join(root, "content", "google-reviews.json"), JSON.stringify(reviews, null, 2));
console.log(`${reviews.length} Google-reviews → content/google-reviews.json (${reviews.filter((r) => r.avatar).length} met profielfoto)`);
console.log(reviews.map((r) => `${r.stars}★ ${r.name}${r.avatar ? " 📷" : ""}: ${r.text.slice(0, 60)}`).join("\n"));
