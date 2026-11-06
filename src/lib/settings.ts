import "server-only";
import { cache } from "react";
import { db } from "./db";
import { parse } from "./json";

// Eén centrale plek voor bedrijfsgegevens: header, footer, meta-tags, structured data, sitemap en robots.txt
// lezen allemaal hieruit. Standaardwaarden komen van de huidige honeymoonshop.nl; beheer via /admin/instellingen/.

export const SITE_URL = (process.env.SITE_URL || "https://www.honeymoonshop.nl").replace(/\/$/, "");

export type OpeningHours = { label: string; days: number[]; opens: string; closes: string };

export type SiteSettings = {
  name: string;
  legalName: string;
  tagline: string;
  email: string;
  phone: string;
  phoneIntl: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  kvk: string;
  socials: { facebook: string; instagram: string; pinterest: string; youtube: string };
  googleRating: { score: string; count: number; url: string };
  openingHours: OpeningHours[];
  closedNote: string;
  topbar: string;
};

export type AppointmentType = { key: string; label: string; short: string; description: string; durationMin: number; slots: Record<string, string[]> };

export type AppointmentSettings = {
  types: AppointmentType[];
  capacityPerSlot: number;
  closedDates: string[];
  leadDays: number;
  maxDaysAhead: number;
  notifyEmail: string;
};

export type HomeSettings = {
  heroVideo: string;
  heroPoster: string;
  heroImages: string[];
  heroEyebrow: string;
  heroTitle: string;
  heroText: string;
  brideImage: string;
  groomImage: string;
};

type LastTest = { ok: boolean; at: string; message: string };

export type Connections = {
  /** headCode/bodyCode: extra code (bv. verificatie, pixels) die mee wordt geladen als GTM aan staat */
  gtm: { enabled: boolean; containerId: string; headCode: string; bodyCode: string };
  /** SparkPost: verstuurt e-mails van formulieren (meldingen en bevestigingen) */
  sparkpost: { enabled: boolean; region: "us" | "eu"; fromEmail: string; fromName: string; replyTo: string; keyEnc: string; keyHint: string; lastTest?: LastTest };
  /** Pulse: tickets uit het beheer worden als JSON naar deze URL gestuurd */
  pulse: { enabled: boolean; url: string; projectId: string; keyEnc: string; keyHint: string; lastTest?: LastTest };
  ai: { enabled: boolean; provider: "openai" | "anthropic"; model: string; imageModel: string; keyEnc: string; keyHint: string; lastTest?: { ok: boolean; at: string; message: string } };
  /** AI Foto: OpenAI (ChatGPT Images) maakt in de pas-tool een foto van de bezoeker in de jurk of het pak. */
  aiImage: { enabled: boolean; model: string; quality: "low" | "medium" | "high"; keyEnc: string; keyHint: string; lastTest?: { ok: boolean; at: string; message: string } };
};

export const DEFAULT_SITE: SiteSettings = {
  name: "Honeymoon shop",
  legalName: "Honeymoon shop",
  tagline: "Dé bruidswinkel van Rotterdam voor trouwjurken, trouwpakken en bruidsaccessoires",
  email: "info@honeymoonshop.nl",
  phone: "(010) 412 61 43",
  phoneIntl: "+31104126143",
  street: "Korte Hoogstraat 4",
  postalCode: "3011 GL",
  city: "Rotterdam",
  country: "NL",
  kvk: "24242775",
  socials: {
    facebook: "https://www.facebook.com/HoneymoonshopNL/",
    instagram: "https://www.instagram.com/honeymoonshopnl/",
    pinterest: "https://nl.pinterest.com/honeymoonshop/",
    youtube: "https://www.youtube.com/user/honeymoonshop",
  },
  googleRating: { score: "8.8", count: 184, url: "https://www.google.com/maps/search/?api=1&query=honeymoon+shop" },
  openingHours: [
    { label: "ma", days: [1], opens: "12:00", closes: "17:30" },
    { label: "di t/m vr", days: [2, 3, 4, 5], opens: "09:30", closes: "17:30" },
    { label: "za", days: [6], opens: "09:30", closes: "18:00" },
    { label: "zo", days: [0], opens: "11:00", closes: "17:00" },
  ],
  closedNote: "Wij zijn gesloten op feestdagen.",
  topbar: "Maak hier je afspraak",
};

// Tijdsloten per weekdag (0 = zondag). Trouwjurk-slots komen van de huidige afsprakenplanner (09:30, 12:30, 15:00).
export const DEFAULT_APPOINTMENTS: AppointmentSettings = {
  types: [
    {
      key: "trouwjurk",
      label: "Trouwjurk passen",
      short: "Bride to be",
      description: "Een persoonlijke styliste, alle tijd voor jou en je gezelschap — en als je jouw jurk vindt, een glas bubbels.",
      durationMin: 150,
      slots: { "0": ["11:00", "13:30"], "1": ["12:30", "15:00"], "2": ["09:30", "12:30", "15:00"], "3": ["09:30", "12:30", "15:00"], "4": ["09:30", "12:30", "15:00"], "5": ["09:30", "12:30", "15:00"], "6": ["09:30", "12:30", "15:00"] },
    },
    {
      key: "trouwpak",
      label: "Trouwpak passen",
      short: "Groom to be",
      description: "Persoonlijk advies in onze Men's shop: van klassiek kostuum tot maatpak, inclusief accessoires.",
      durationMin: 60,
      slots: { "0": ["11:00", "12:30", "14:00", "15:30"], "1": ["12:30", "14:00", "15:30"], "2": ["10:00", "11:30", "13:00", "14:30", "16:00"], "3": ["10:00", "11:30", "13:00", "14:30", "16:00"], "4": ["10:00", "11:30", "13:00", "14:30", "16:00"], "5": ["10:00", "11:30", "13:00", "14:30", "16:00"], "6": ["10:00", "11:30", "13:00", "14:30", "16:00"] },
    },
    {
      key: "perfect-match",
      label: "Samen passen (Perfect Match)",
      short: "Perfect Match",
      description: "Tegelijk passen op aparte verdiepingen — wij zorgen dat jurk en pak matchen zonder dat jullie elkaar zien.",
      durationMin: 150,
      slots: { "0": ["11:00"], "2": ["09:30", "12:30"], "3": ["09:30", "12:30"], "4": ["09:30", "12:30"], "5": ["09:30", "12:30"], "6": ["09:30", "12:30"] },
    },
    {
      key: "doorpassen",
      label: "Doorpassen",
      short: "Doorpassen",
      description: "Je jurk is binnen of vermaakt: kom hem doorpassen in ons eigen atelier.",
      durationMin: 45,
      slots: { "2": ["10:00", "11:00", "14:00", "16:00"], "3": ["10:00", "11:00", "14:00", "16:00"], "4": ["10:00", "11:00", "14:00", "16:00"], "5": ["10:00", "11:00", "14:00", "16:00"], "6": ["10:00", "11:00"] },
    },
  ],
  capacityPerSlot: 2,
  closedDates: ["2026-12-25", "2026-12-26", "2027-01-01", "2027-04-05", "2027-04-27", "2027-05-13", "2027-05-24"],
  leadDays: 1,
  maxDaysAhead: 240,
  notifyEmail: "info@honeymoonshop.nl",
};

export const DEFAULT_HOME: HomeSettings = {
  heroVideo: "https://www.youtube.com/watch?v=d8SJwJjztjQ",
  heroPoster: "/uploads/limited_07_s8_a270927-1780585254-e1786357080767-1536x855.webp",
  heroImages: [
    "/uploads/limited_07_s8_a270927-1780585254-e1786357080767-1536x855.webp",
    "/uploads/hms-website-2559x1080-header-1940-x-1070-px-10-e1686743541360-1536x754.webp",
    "/uploads/j58grxerzovm1xruldvmk_v0sngv4b_00001-e1776713393224-1536x778.webp",
    "/uploads/jab_ss23_homepage_refresh__felicia-1536x898.webp",
  ],
  heroEyebrow: "Bruidsmode in hartje Rotterdam",
  heroTitle: "Creating happiness for the bride & groom",
  heroText: "Vijf verdiepingen trouwjurken en trouwpakken, eigen atelier en stylisten die alle tijd voor jullie nemen.",
  brideImage: "/uploads/de-luxe-10021_12a2170-edit-1528x2048.webp",
  groomImage: "/uploads/1obtqmpirlh0fexr4afqj_vacn3cb5_00001-1536x1147.webp",
};

export const DEFAULT_CONNECTIONS: Connections = {
  gtm: { enabled: false, containerId: "", headCode: "", bodyCode: "" },
  sparkpost: { enabled: false, region: "eu", fromEmail: "info@honeymoonshop.nl", fromName: "Honeymoon shop", replyTo: "info@honeymoonshop.nl", keyEnc: "", keyHint: "" },
  pulse: { enabled: false, url: "", projectId: "", keyEnc: "", keyHint: "" },
  ai: { enabled: false, provider: "openai", model: "", imageModel: "gpt-image-1", keyEnc: "", keyHint: "" },
  aiImage: { enabled: false, model: "gpt-image-2.5-flare", quality: "medium", keyEnc: "", keyHint: "" },
};

async function read<T>(key: string, fallback: T): Promise<T> {
  const row = await db.setting.findUnique({ where: { key } });
  const value = parse<Partial<T>>(row?.value, {});
  return { ...fallback, ...value };
}

export const getSite = cache(() => read("site", DEFAULT_SITE));
export const getAppointmentSettings = cache(() => read("appointments", DEFAULT_APPOINTMENTS));
export const getHome = cache(() => read("home", DEFAULT_HOME));
export const getConnections = cache(async () => {
  const c = await read("connections", DEFAULT_CONNECTIONS);
  return {
    gtm: { ...DEFAULT_CONNECTIONS.gtm, ...c.gtm },
    sparkpost: { ...DEFAULT_CONNECTIONS.sparkpost, ...c.sparkpost },
    pulse: { ...DEFAULT_CONNECTIONS.pulse, ...c.pulse },
    ai: { ...DEFAULT_CONNECTIONS.ai, ...c.ai },
    aiImage: { ...DEFAULT_CONNECTIONS.aiImage, ...c.aiImage },
  } as Connections;
});

// ---------- formulieren ----------
export type FormKey = "afspraak" | "contact" | "lookbook" | "verhaal";
export type FormConfig = {
  /** melding naar de winkel */
  notify: boolean;
  to: string;
  subject: string;
  /** bevestiging naar de bezoeker */
  confirm: boolean;
  confirmSubject: string;
  confirmText: string;
  /** melding op de website na versturen ({naam} = voornaam); leeg = standaardtekst */
  successText: string;
};
export type FormSettings = Record<FormKey, FormConfig>;

export const FORM_LABELS: Record<FormKey, { label: string; where: string; inbox: string; vars: string }> = {
  afspraak: { label: "Pasafspraak", where: "/afspraak-maken/", inbox: "/admin/afspraken/", vars: "{naam} {type} {datum} {tijd} {telefoon} {email}" },
  contact: { label: "Contactformulier", where: "/contact/", inbox: "/admin/berichten/", vars: "{naam} {onderwerp} {bericht} {telefoon} {email}" },
  lookbook: { label: "Look Book-aanvraag", where: "/aanmelden-nieuwsbrief/", inbox: "/admin/berichten/", vars: "{naam} {trouwdatum} {email}" },
  verhaal: { label: "Real bride-verhaal insturen", where: "/real-brides/real-brides-toevoegen/", inbox: "/admin/reviews/", vars: "{naam} {email}" },
};

export const DEFAULT_FORMS: FormSettings = {
  afspraak: {
    notify: true,
    to: "info@honeymoonshop.nl",
    subject: "Nieuwe pasafspraak: {type} op {datum} om {tijd}",
    confirm: true,
    confirmSubject: "Je pasafspraak bij de Honeymoon shop",
    confirmText: "Hoi {naam},\n\nWat leuk dat je komt passen! Je afspraak staat gepland op {datum} om {tijd} ({type}).\n\nKun je onverhoopt niet? Laat het ons dan even weten via (010) 412 61 43.\n\nTot snel!\nTeam Honeymoon shop",
    successText: "",
  },
  contact: {
    notify: true,
    to: "info@honeymoonshop.nl",
    subject: "Nieuw bericht via de website: {onderwerp}",
    confirm: false,
    confirmSubject: "We hebben je bericht ontvangen",
    confirmText: "Hoi {naam},\n\nBedankt voor je bericht. We reageren binnen één werkdag.\n\nGroetjes,\nTeam Honeymoon shop",
    successText: "Bedankt {naam}! We hebben je bericht ontvangen en reageren binnen één werkdag.",
  },
  lookbook: {
    notify: true,
    to: "info@honeymoonshop.nl",
    subject: "Nieuwe Look Book-aanvraag",
    confirm: true,
    confirmSubject: "Je gratis Look Book",
    confirmText: "Hoi {naam},\n\nLeuk dat je het Look Book hebt aangevraagd! Je ontvangt het binnenkort in je mailbox.\n\nTeam Honeymoon shop",
    successText: "Gelukt! Je ontvangt het Look Book binnenkort in je mailbox.",
  },
  verhaal: {
    notify: true,
    to: "info@honeymoonshop.nl",
    subject: "Nieuw real bride-verhaal ingestuurd",
    confirm: false,
    confirmSubject: "Bedankt voor je verhaal",
    confirmText: "Hoi {naam},\n\nDankjewel voor het delen van jullie verhaal! We bekijken het en plaatsen het binnenkort.\n\nTeam Honeymoon shop",
    successText: "Dankjewel voor het delen! We bekijken je verhaal en plaatsen het binnenkort.",
  },
};

export const getForms = cache(async () => {
  const saved = await read<Partial<FormSettings>>("forms", {});
  return Object.fromEntries((Object.keys(DEFAULT_FORMS) as FormKey[]).map((k) => [k, { ...DEFAULT_FORMS[k], ...(saved[k] ?? {}) }])) as FormSettings;
});

// ---------- SEO (algemeen) ----------
export type SeoSettings = { googleVerification: string; bingVerification: string; robotsDisallow: string[] };
export const DEFAULT_SEO: SeoSettings = { googleVerification: "", bingVerification: "", robotsDisallow: [] };
export const getSeo = cache(() => read("seo", DEFAULT_SEO));

// ---------- specificaties (shop) ----------
export type ProductKind = "dress" | "suit" | "accessory";
/** Vrije specificatievelden per soort product (naast de filterkenmerken), bv. Levertijd of Stof. */
export type SpecSettings = Record<ProductKind, string[]>;
export const DEFAULT_SPECS: SpecSettings = { dress: ["Levertijd", "Maten", "Sleep"], suit: ["Levertijd", "Maten", "Stof"], accessory: ["Materiaal", "Kleur", "Maat"] };
export const getSpecs = cache(() => read("specs", DEFAULT_SPECS));

export async function saveSetting(key: string, value: unknown) {
  const json = JSON.stringify(value);
  await db.setting.upsert({ where: { key }, create: { key, value: json }, update: { value: json } });
}

export const absUrl = (path: string) => (/^https?:\/\//.test(path) ? path : `${SITE_URL}${path.startsWith("/") ? "" : "/"}${path}`);
