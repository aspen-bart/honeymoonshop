// Opschonen na het importeren (onderdeel van de seed, los te draaien met `npx tsx prisma/polish.ts`):
// - redirects voor kapotte interne links die al in de oude content stonden
// - accessoires zonder categorie koppelen aan "Accessoires voor de bruid" (anders onvindbaar)
// - dubbele meta-titles/descriptions uniek maken (de oude site had gekopieerde titels)
import type { PrismaClient } from "@prisma/client";

export const EXTRA_REDIRECTS: [string, string][] = [
  ["/trouwjurken/sample-collectie/", "/trouwjurken/big-sale/"],
  ["/afspraak-maken-2/", "/afspraak-maken/"],
  ["/trouwjurken/merk/maggie-sottero/", "/trouwjurken/maggie-sottero/"],
  ["/trouwjurken/merk/big-sale/", "/trouwjurken/big-sale/"],
  ["/bruid/bruidsschoenen/", "/bruid/accessoires/"],
  ["/accessoires-bruidegom/riemen-bruidegom/", "/bruidegom/heren-accessoires/"],
  ["/bruidegom/trouwschoenen/", "/bruidegom/heren-accessoires/"],
  ["/pakken/trouwkostuum-immediate16926/", "/pakken/trouwkostuum-immediate-16925/"],
  ["/mijn-honeymoon-shop/", "/favorieten/"],
  ["/trouwjurken/less-is-more/", "/trouwjurken/simpel/"],
  ["/trouwjurken/glitters/mouwen/", "/trouwjurken/glitters/"],
  ["/trouwjurken/kant/mouwen/", "/trouwjurken/kant/"],
  ["/trouwjurken/mouwen/", "/trouwjurken/lange-mouwen/"],
  ["/trouwjurken/1001-1500/", "/trouwjurken/001-1500/"],
  ["/trouwjurken/empire/", "/silhouetten-voor-je-trouwjurk/"],
  ["/trouwjurken/trouwjurk-maeve-rebecca-ingram/", "/trouwjurken/rebecca-ingram/"],
  ["/trouwjurken/trouwjurk-seina-labybird/", "/trouwjurken/ladybird/"],
  ["/trouwjurken/bijzondere-rug/kant/", "/trouwjurken/bijzondere-rug/"],
  ["/trouwjurken/trouwjurk-lucienne-jarice/", "/trouwjurken/jarice/"],
  ["/bruid/bruidsriemen/riemen/", "/bruid/bruidsaccessoires/"],
  ["/trouwjurken/prijs/tot-1000/", "/trouwjurken/0-1000/"],
  // lege pagina op de oude site; de uitgebreide silhouettengids staat elders
  ["/atelier-van-esmee/silhouet/", "/silhouetten-voor-je-trouwjurk/"],
];

const BRAND = / ?[-|–] ?Honeymoon ?shop$/i;

export async function polish(db: PrismaClient) {
  // Lege pagina's die een redirect krijgen, verdwijnen (anders zou de pagina de redirect blokkeren)
  await db.page.deleteMany({ where: { path: { in: EXTRA_REDIRECTS.map(([from]) => from) }, html: "" } });
  for (const [from, to] of EXTRA_REDIRECTS) await db.redirect.upsert({ where: { from }, create: { from, to }, update: { to } });

  const root = await db.category.findUnique({ where: { path: "/bruid/accessoires/" } });
  if (root) {
    const loose = await db.product.findMany({ where: { kind: "accessory", categories: { none: {} } }, select: { id: true } });
    for (const p of loose) await db.product.update({ where: { id: p.id }, data: { categories: { connect: { id: root.id } } } });
  }

  // Dubbele titels/descriptions: per tabel groeperen en alle dubbelingen na de eerste uniek maken
  const products = await db.product.findMany({ select: { id: true, name: true, metaTitle: true, metaDescription: true, articleNumber: true, slug: true, descriptionHtml: true }, orderBy: { publishedAt: "asc" } });
  const reviews = await db.review.findMany({ select: { id: true, name: true, metaTitle: true, metaDescription: true, slug: true }, orderBy: { publishedAt: "asc" } });
  const seenT = new Set<string>();
  const seenD = new Set<string>();
  const suffix = (slug: string) => slug.match(/-(\d+)$/)?.[1] ?? slug.slice(-6);
  for (const p of products) {
    let title = p.metaTitle;
    if (title && seenT.has(title)) title = title.toLowerCase().includes(p.name.toLowerCase()) ? `${p.name} (${p.articleNumber || suffix(p.slug)}) - Honeymoon shop` : `${p.name} - Honeymoon shop`;
    if (title && seenT.has(title)) title = `${title.replace(BRAND, "")} ${suffix(p.slug)} - Honeymoon shop`;
    let desc = p.metaDescription;
    if (desc && seenD.has(desc)) {
      const text = p.descriptionHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      desc = `${p.name} (${p.articleNumber || suffix(p.slug)}) – ${text}`;
      if (desc.length > 158) desc = `${desc.slice(0, 156).replace(/\s+\S*$/, "")}…`;
    }
    if (title) seenT.add(title);
    if (desc) seenD.add(desc);
    if (title !== p.metaTitle || desc !== p.metaDescription) await db.product.update({ where: { id: p.id }, data: { metaTitle: title, metaDescription: desc } });
  }
  for (const r of reviews) {
    let title = r.metaTitle;
    if (title && seenT.has(title)) title = `${title.replace(BRAND, "")} (${suffix(r.slug)}) - Honeymoon shop`;
    let desc = r.metaDescription;
    if (desc && seenD.has(desc)) desc = null;
    if (title) seenT.add(title);
    if (desc) seenD.add(desc);
    if (title !== r.metaTitle || desc !== r.metaDescription) await db.review.update({ where: { id: r.id }, data: { metaTitle: title, metaDescription: desc } });
  }
}

if (require.main === module) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaClient } = require("@prisma/client") as typeof import("@prisma/client");
  const db = new PrismaClient();
  polish(db)
    .then(() => console.log("Opgeschoond."))
    .finally(() => db.$disconnect());
}
