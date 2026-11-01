# Honeymoon shop — nieuwe website (localhost)

Herbouw van www.honeymoonshop.nl: dezelfde URL's (met slash aan het eind), alle content en afbeeldingen
overgenomen, een vetter design, een vernieuwde afsprakenplanner, online passen ("Upload jezelf 🙂") en een
compleet beheer onder `/admin/`.

## Starten

```bash
npm install
npm run setup        # database aanmaken + vullen uit content/*.json
npm run dev          # http://localhost:3300
```

Testaccounts voor `/admin/` staan in `.env` (beheerder, redacteur, alleen-lezen) en worden door `npm run db:seed`
aangemaakt. Vervang ze vóór livegang.

| Script | Wat het doet |
|---|---|
| `npm run scrape` | Haalt alle content van honeymoonshop.nl op naar `content/*.json` (HTML-cache in `scripts/raw/`) |
| `npm run images` | Downloadt alle gebruikte afbeeldingen, verkleint ze (max. 1600px) en zet ze als WebP in `public/uploads/` |
| `npm run db:seed` | Vult de database opnieuw uit `content/` (gebruikers en instellingen blijven bestaan) |
| `npm run build` | Productie-build + automatische SEO-controle (`scripts/seo-check.mjs`, faalt bij fouten) |
| `npm run seo:check` | Alleen de SEO-controle (start zelf `next start`; of `SEO_BASE=http://localhost:3300`) |

Stack: Next.js 15 (App Router) · Tailwind 4 · Prisma (SQLite lokaal, PostgreSQL in productie via
`scripts/prisma.mjs`) · eigen beheer met JWT-sessies (jose) en bcrypt.

## Wat er is overgenomen

| Type | Aantal | URL's |
|---|---|---|
| Trouwjurken | 271 | `/trouwjurken/<slug>/` (incl. filters: stijl, silhouet, kleur, prijs, details, materiaal, mouwen, top, merk) |
| Trouwpakken | 85 | `/pakken/<slug>/` |
| Accessoires | 113 | oorspronkelijke paden, bv. `/accessoires-bruid/haaraccessoires/tiara-en-diadeem/tiara-bb-719-poirier/` |
| Productcategorieën | 26 | oorspronkelijke paden, met tekst boven én onder de producten |
| Collecties | 5 | `/trouwjurken/2027/`, `/big-bliss/`, `/big-sale/`, `/new-arrivals/`, `/pakken/nieuwe-collectie/` |
| Pagina's | 53 | alle pagina's uit de page-sitemap behalve login/account/wachtwoord, + `/cookies/`, `/favorieten/`, `/vacatures/`, `/aanmelden-nieuwsbrief/` |
| Blogs | 75 + 7 categorieën | `/blog/<slug>/` (en de ene blog op het hoogste niveau) |
| Real brides (reviews) | 467 | `/real-brides/<slug>/` |
| Afbeeldingen | 3.716 | `/uploads/*.webp` (58 afbeeldingen die op de oude site al 404 gaven zijn weggelaten) |
| Redirects | 21 | de doorverwijzingen die de oude site al had (beheer: `/admin/redirects/`) |

Filterpagina's van de dressfinder (bv. `/trouwjurken/kant/`) blijven bereikbaar, maar met `noindex, follow`
en zonder sitemap — zoals gevraagd ("filters hoeft niet").

## Belangrijke keuzes

- **Prerendering**: elke publieke URL wordt tijdens de build volledig als HTML gerenderd (`generateStaticParams`).
  Nieuwe of gewijzigde content uit het beheer wordt direct op aanvraag opnieuw gerenderd (`revalidatePath`), dus
  opnieuw deployen is niet nodig.
- **URL's**: middleware geeft in één stap een 301 naar https + www + slash; oude paden en gewijzigde paden
  (automatisch bij het wijzigen van een URL in het beheer) staan in de tabel `Redirect`.
- **Geen afrekenen**: accessoires tonen de prijs en "Verkrijgbaar in onze winkel"; jurken en pakken een
  prijsindicatie. Structured data gebruikt `InStoreOnly`; verzendkosten/retourbeleid zijn bewust weggelaten.
- **Online passen**: de foto blijft in de browser (canvas). De optionele AI-weergave "hele lichaam" gebruikt de
  OpenAI images-API via de eigen server en verschijnt pas als die connectie in `/admin/connecties/` actief is.
- **Bedrijfsgegevens** staan op één plek (`src/lib/settings.ts`, beheerbaar in `/admin/instellingen/`) en voeden
  header, footer, meta-tags, structured data, sitemap en robots.txt.

## Open punten / checklist voor livegang

- [ ] **Video voor de homepage-hero**: nu een bewegende fotoslideshow; plak een mp4/webm-URL in Instellingen.
- [ ] **E-mailmeldingen** bij nieuwe afspraken/berichten: nog niet gekoppeld (alles komt binnen in het beheer).
- [ ] **Geo-coördinaten** van de winkel ontbreken in LocalBusiness (niet verzonnen) — graag aanleveren.
- [ ] **Juridische teksten**: `/cookies/` is nieuw (concept, juridisch laten controleren); privacy en
      voorwaarden zijn 1-op-1 overgenomen.
- [ ] Testaccounts vervangen, `AUTH_SECRET` en `DATABASE_URL` (PostgreSQL) instellen.
- [ ] Na deploy: Rich Results Test per paginatype (home, jurk, blog, categorie), sitemap indienen in Google
      Search Console en Bing Webmaster Tools, social previews controleren.
- [ ] Meta-titles/descriptions zijn bewust ongewijzigd overgenomen (SEO behouden); `seo-report.json` toont welke
      buiten de aanbevolen lengte vallen — aanpassen kan per item in het beheer (met AI-voorstel).
