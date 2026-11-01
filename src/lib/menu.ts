// Hoofdmenu (4 items + call-to-action) en footer. Alle links zijn echte, bestaande URL's met slash.

export type MenuLink = { label: string; href: string };
export type MenuColumn = { title: string; links: MenuLink[] };
export type MenuItem = { label: string; href: string; columns: MenuColumn[]; feature?: { title: string; text: string; href: string; image: string; cta: string } };

export const MAIN_MENU: MenuItem[] = [
  {
    label: "Bruid",
    href: "/trouwjurk-en-accessoires/",
    columns: [
      {
        title: "Trouwjurken",
        links: [
          { label: "Alle trouwjurken", href: "/trouwjurken/" },
          { label: "Nieuw binnen", href: "/trouwjurken/new-arrivals/" },
          { label: "Collectie 2027", href: "/trouwjurken/2027/" },
          { label: "Big Sale", href: "/trouwjurken/big-sale/" },
          { label: "Big Bliss (plus size)", href: "/trouwjurken/big-bliss/" },
          { label: "Alle merken", href: "/trouwjurk-en-accessoires/onze-merken/" },
        ],
      },
      {
        title: "Populaire stijlen",
        links: [
          { label: "Strak", href: "/trouwjurken/strak/" },
          { label: "Bohemian", href: "/trouwjurken/bohemian/" },
          { label: "Kant", href: "/trouwjurken/kant/" },
          { label: "Lange mouwen", href: "/trouwjurken/lange-mouwen/" },
          { label: "A-lijn", href: "/trouwjurken/a-lijn/" },
          { label: "Zeemeermin", href: "/trouwjurken/zeemeermin-trouwjurken/" },
        ],
      },
      {
        title: "Accessoires",
        links: [
          { label: "Alle bruidsaccessoires", href: "/bruid/accessoires/" },
          { label: "Bruidssluiers", href: "/accessoires-bruid/sluiers/" },
          { label: "Bruidssieraden", href: "/bruid/bruidssieraden/" },
          { label: "Haaraccessoires", href: "/bruid/haaraccessoires/" },
          { label: "Bruidslingerie", href: "/bruid/bruids-lingerie/" },
          { label: "Hoepels en petticoats", href: "/bruid/hoepels-en-petticoats/" },
        ],
      },
    ],
    feature: { title: "Bride to be", text: "Plan je pasafspraak met een eigen styliste.", href: "/afspraak-maken/trouwjurk-passen/", image: "/uploads/hfghfpj1kbqj6djbf7j6z_wyg37p7b_00001-rmasesg0hvjut681200bo5pijl5t30qy424tzi2jjk.webp", cta: "Trouwjurk passen" },
  },
  {
    label: "Bruidegom",
    href: "/bruidegom/",
    columns: [
      {
        title: "Trouwpakken",
        links: [
          { label: "Alle trouwpakken", href: "/pakken/" },
          { label: "Nieuwe collectie", href: "/pakken/nieuwe-collectie/" },
          { label: "Maatpakken", href: "/bruidegom/maatpak/" },
          { label: "The Grooms Edit (sale)", href: "/trouwpakken-sale-the-grooms-edit/" },
          { label: "Onze merken", href: "/bruidegom/onze-merken/" },
        ],
      },
      {
        title: "Kleuren",
        links: [
          { label: "Blauw", href: "/pakken/blauw-trouwpak/" },
          { label: "Beige", href: "/pakken/beige-trouwpak/" },
          { label: "Grijs", href: "/pakken/grijs-trouwpak/" },
          { label: "Groen", href: "/pakken/groen-trouwpak/" },
          { label: "Zwart", href: "/pakken/zwart-trouwpak/" },
        ],
      },
      {
        title: "Meer voor hem",
        links: [
          { label: "Alles voor de bruidegom", href: "/bruidegom/" },
          { label: "Heren-accessoires", href: "/bruidegom/heren-accessoires/" },
          { label: "The Perfect Match", href: "/perfect-match/" },
          { label: "Beste trouwpakkenwinkel 2025", href: "/beste-trouwpakkenwinkel-van-2025/" },
        ],
      },
    ],
    feature: { title: "Groom to be", text: "Persoonlijk advies in onze Men's shop.", href: "/afspraak-maken/trouwpak-passen/", image: "/uploads/f9garn93u8xzhojyafwtx_bvweu8lg_00001-rmaseri6b1ikhk9e7hlp3ny1y7afvbn7rxhci83xps.webp", cta: "Trouwpak passen" },
  },
  {
    label: "Inspiratie",
    href: "/blog/",
    columns: [
      {
        title: "Lezen & kijken",
        links: [
          { label: "Blog", href: "/blog/" },
          { label: "Real Brides & Grooms", href: "/real-brides/" },
          { label: "Gratis Look Book", href: "/look-book/" },
          { label: "Trouwjurken trends 2027", href: "/blog/trouwjurken-trends-2027/" },
        ],
      },
      {
        title: "Gidsen",
        links: [
          { label: "Silhouetten voor je trouwjurk", href: "/silhouetten-voor-je-trouwjurk/" },
          { label: "Stoffen en materialen", href: "/stoffen-en-materialen-trouwjurk/" },
          { label: "Je eerste pasafspraak", href: "/de-winkel/eerste-pasafspraak/" },
          { label: "Welke trouwjurk past bij mij?", href: "/blog/welke-trouwjurk-past-bij-mij/" },
        ],
      },
    ],
  },
  {
    label: "Onze winkel",
    href: "/de-winkel/",
    columns: [
      {
        title: "Over ons",
        links: [
          { label: "Over de Honeymoon shop", href: "/de-winkel/over-de-honeymoon-shop/" },
          { label: "Ons team", href: "/team/" },
          { label: "Het atelier", href: "/de-winkel/het-atelier/" },
          { label: "CBW-erkend", href: "/de-winkel/cbw-erkend/" },
          { label: "Vacatures", href: "/vacatures/" },
        ],
      },
      {
        title: "Service",
        links: [
          { label: "Alle services", href: "/de-winkel/" },
          { label: "Veelgestelde vragen", href: "/de-winkel/veelgestelde-vragen/" },
          { label: "Full service pakket", href: "/trouwjurken/full-service-pakket/" },
          { label: "Bereikbaarheid en parkeren", href: "/bereikbaarheid-en-parkeergelegenheden/" },
          { label: "Contact", href: "/contact/" },
        ],
      },
    ],
  },
];

export const FOOTER_COLUMNS: MenuColumn[] = [
  {
    title: "Collectie",
    links: [
      { label: "Trouwjurken", href: "/trouwjurken/" },
      { label: "Trouwpakken", href: "/pakken/" },
      { label: "Bruidsaccessoires", href: "/bruid/accessoires/" },
      { label: "Nieuw binnen", href: "/nieuw/" },
      { label: "Trouwjurken sale", href: "/2026-trouwjurken-sale-korting/" },
      { label: "Atelier van Esmee", href: "/atelier-van-esmee/" },
      { label: "Cadeaubon", href: "/product-categorie/accessoires-bruid/cadeaus/cadeaubon/" },
    ],
  },
  {
    title: "Service",
    links: [
      { label: "Pasafspraak maken", href: "/afspraak-maken/" },
      { label: "Veelgestelde vragen", href: "/de-winkel/veelgestelde-vragen/" },
      { label: "Trouwjurk reinigen", href: "/trouwjurk-reinigen/" },
      { label: "Hoepelmaten", href: "/accessoires/service-pagina-webshop/hoepel-maten/" },
      { label: "Lingeriematen", href: "/accessoires/service-pagina-webshop/lingerie-maten/" },
      { label: "Over de webshop", href: "/accessoires/over-de-webshop/" },
      { label: "Mijn favorieten", href: "/favorieten/" },
    ],
  },
  {
    title: "Over ons",
    links: [
      { label: "Onze winkel", href: "/de-winkel/over-de-honeymoon-shop/" },
      { label: "Team", href: "/team/" },
      { label: "Real Brides & Grooms", href: "/real-brides/" },
      { label: "Deel jouw verhaal", href: "/real-brides/real-brides-toevoegen/" },
      { label: "Blog", href: "/blog/" },
      { label: "Kerstactie", href: "/kerst-actie/" },
      { label: "EK-winactie", href: "/ek-winactie/" },
      { label: "Aangepaste openingstijden", href: "/aangepaste-openingstijden-2024/" },
    ],
  },
];

export const LEGAL_LINKS: MenuLink[] = [
  { label: "Privacyverklaring", href: "/privacy/" },
  { label: "Cookieverklaring", href: "/cookies/" },
  { label: "Algemene voorwaarden", href: "/algemene-voorwaarden/" },
  { label: "Verkoopvoorwaarden", href: "/de-winkel/verkoop-voorwaarden/" },
  { label: "Voorwaarden webwinkel", href: "/accessoires/service-pagina-webshop/algemene-voorwaarden-webwinkel/" },
];
