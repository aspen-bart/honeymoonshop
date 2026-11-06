// Haalt de Google-reviews uit de opgeslagen pagina's van de oude site (Trustindex-widget) en schrijft
// content/google-reviews.json. Alleen naam, sterren en tekst; geen profielfoto's.
// Gebruik: node scripts/google-reviews.mjs (na npm run scrape)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const raw = path.join(root, "scripts", "raw");
const seen = new Map();
for (const f of fs.readdirSync(raw).filter((x) => x.endsWith(".html"))) {
  const html = fs.readFileSync(path.join(raw, f), "utf8");
  if (!html.includes("ti-review-item")) continue;
  const $ = cheerio.load(html);
  $(".ti-review-item.source-Google").each((_, el) => {
    const name = $(el).find(".ti-name").first().text().replace(/\s+/g, " ").trim();
    const text = $(el).find(".ti-review-text-container").first().text().replace(/\s+/g, " ").trim();
    const stars = $(el).find("img.ti-star[src*='/star/f.svg']").length;
    if (!name || !text) return;
    const key = `${name}|${text.slice(0, 40)}`;
    if (!seen.has(key)) seen.set(key, { name, stars, text });
  });
}
const reviews = [...seen.values()];
fs.writeFileSync(path.join(root, "content", "google-reviews.json"), JSON.stringify(reviews, null, 2));
console.log(`${reviews.length} Google-reviews → content/google-reviews.json`);
console.log(reviews.map((r) => `${r.stars}★ ${r.name}: ${r.text.slice(0, 70)}`).join("\n"));
