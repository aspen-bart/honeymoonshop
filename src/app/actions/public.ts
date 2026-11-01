"use server";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { z } from "zod";
import { slotIsFree } from "@/lib/appointments";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { getAppointmentSettings } from "@/lib/settings";
import { slugify } from "@/lib/text";

// Openbare formulieren. Elke actie valideert opnieuw op de server (zod), heeft een honeypot-veld ("website"),
// een minimale invultijd (bots zijn sneller dan 3 seconden) en een rate limit per IP.

export type FormState = { ok: boolean; message?: string; errors?: Record<string, string>; data?: Record<string, string> };

const phone = z
  .string()
  .trim()
  .regex(/^[+()\d\s-]{8,20}$/, "Vul een geldig telefoonnummer in");
const email = z.string().trim().toLowerCase().email("Vul een geldig e-mailadres in").max(160);
const name = z.string().trim().min(2, "Vul je naam in").max(100);

function spam(form: FormData) {
  if (String(form.get("website") ?? "")) return true;
  const started = Number(form.get("started") ?? 0);
  return !started || Date.now() - started < 3000;
}

function fieldErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) out[String(issue.path[0])] ??= issue.message;
  return out;
}

const appointmentSchema = z.object({
  type: z.string().min(1, "Kies een soort afspraak"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Kies een datum"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Kies een tijd"),
  name,
  email,
  phone,
  weddingDate: z
    .string()
    .trim()
    .regex(/^(\d{4}-\d{2}-\d{2})?$/, "Ongeldige datum")
    .optional(),
  companions: z.coerce.number().int().min(0).max(6),
  budget: z.string().max(40).optional(),
  notes: z.string().trim().max(2000).optional(),
  favorites: z.array(z.string().regex(/^\/[a-z0-9\-/]+\/$/)).max(30),
  product: z.string().max(300).optional(),
  source: z.string().max(60).optional(),
  privacy: z.literal("on", { errorMap: () => ({ message: "Ga akkoord met de privacyverklaring" }) }),
});

export async function bookAppointment(_: FormState, form: FormData): Promise<FormState> {
  if (spam(form)) return { ok: false, message: "Je verzoek kon niet worden verwerkt. Probeer het opnieuw." };
  if (!(await rateLimit("appointment", 5, 60 * 60 * 1000))) return { ok: false, message: "Je hebt al meerdere afspraken aangevraagd. Bel ons gerust als het niet lukt." };
  const parsed = appointmentSchema.safeParse({
    ...Object.fromEntries(form),
    favorites: form.getAll("favorites").map(String),
  });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error), message: "Controleer de gemarkeerde velden." };
  const d = parsed.data;
  const settings = await getAppointmentSettings();
  const type = settings.types.find((t) => t.key === d.type);
  if (!type) return { ok: false, errors: { type: "Kies een soort afspraak" } };
  if (!(await slotIsFree(d.type, d.date, d.time))) return { ok: false, errors: { time: "Dit tijdstip is net vergeven. Kies een ander moment." }, message: "Dit tijdstip is net vergeven." };
  const product = d.product ? await db.product.findUnique({ where: { path: d.product }, select: { id: true } }) : null;
  const appt = await db.appointment.create({
    data: {
      type: d.type,
      date: d.date,
      time: d.time,
      name: d.name,
      email: d.email,
      phone: d.phone,
      weddingDate: d.weddingDate || null,
      companions: d.companions,
      budget: d.budget || null,
      notes: d.notes || null,
      favorites: JSON.stringify(d.favorites),
      productId: product?.id ?? null,
      source: d.source || null,
    },
  });
  return { ok: true, data: { id: appt.id, type: type.label, date: d.date, time: d.time, name: d.name, email: d.email, duration: String(type.durationMin) } };
}

const contactSchema = z.object({
  name,
  email,
  phone: phone.optional().or(z.literal("")),
  subject: z.string().trim().max(120).optional(),
  message: z.string().trim().min(10, "Schrijf een bericht van minimaal 10 tekens").max(4000),
  about: z.string().max(300).optional(),
  privacy: z.literal("on", { errorMap: () => ({ message: "Ga akkoord met de privacyverklaring" }) }),
});

export async function sendContact(_: FormState, form: FormData): Promise<FormState> {
  if (spam(form)) return { ok: false, message: "Je bericht kon niet worden verzonden. Probeer het opnieuw." };
  if (!(await rateLimit("contact", 5, 60 * 60 * 1000))) return { ok: false, message: "Je hebt al meerdere berichten gestuurd. Probeer het later opnieuw of bel ons." };
  const parsed = contactSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error), message: "Controleer de gemarkeerde velden." };
  const d = parsed.data;
  await db.contactMessage.create({ data: { name: d.name, email: d.email, phone: d.phone || null, subject: d.subject || null, message: d.message, about: d.about || null } });
  return { ok: true, message: `Bedankt ${d.name.split(" ")[0]}! We hebben je bericht ontvangen en reageren binnen één werkdag.` };
}

const newsletterSchema = z.object({ name, email, weddingDate: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/).optional(), privacy: z.literal("on", { errorMap: () => ({ message: "Ga akkoord met de privacyverklaring" }) }) });

export async function requestLookBook(_: FormState, form: FormData): Promise<FormState> {
  if (spam(form)) return { ok: false, message: "Aanmelden lukte niet. Probeer het opnieuw." };
  if (!(await rateLimit("newsletter", 5, 60 * 60 * 1000))) return { ok: false, message: "Probeer het later opnieuw." };
  const parsed = newsletterSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error), message: "Controleer de gemarkeerde velden." };
  const d = parsed.data;
  await db.contactMessage.create({ data: { name: d.name, email: d.email, subject: "Aanvraag gratis Look Book", message: `Look Book aangevraagd via de website.${d.weddingDate ? ` Trouwdatum: ${d.weddingDate}.` : ""}` } });
  return { ok: true, message: "Gelukt! Je ontvangt het Look Book binnenkort in je mailbox." };
}

const storySchema = z.object({ name: z.string().trim().min(2, "Vul jullie namen in").max(100), email, story: z.string().trim().min(40, "Vertel iets meer (minimaal 40 tekens)").max(5000), privacy: z.literal("on", { errorMap: () => ({ message: "Geef toestemming om je verhaal te plaatsen" }) }) });

export async function submitStory(_: FormState, form: FormData): Promise<FormState> {
  if (spam(form)) return { ok: false, message: "Versturen lukte niet. Probeer het opnieuw." };
  if (!(await rateLimit("story", 3, 60 * 60 * 1000))) return { ok: false, message: "Probeer het later opnieuw." };
  const parsed = storySchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error), message: "Controleer de gemarkeerde velden." };
  const d = parsed.data;
  let image: string | null = null;
  const photo = form.get("photo");
  if (photo instanceof File && photo.size > 0) {
    if (photo.size > 10 * 1024 * 1024 || !photo.type.startsWith("image/")) return { ok: false, errors: { photo: "Kies een foto tot 10 MB" } };
    const dir = path.join(process.cwd(), "public", "uploads", "user");
    await fs.mkdir(dir, { recursive: true });
    const file = `${slugify(d.name)}-${Date.now()}.webp`;
    await sharp(Buffer.from(await photo.arrayBuffer())).rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toFile(path.join(dir, file));
    image = `/uploads/user/${file}`;
  }
  const slug = `${slugify(d.name)}-${Date.now().toString(36)}`;
  const html = d.story
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]!)}</p>`)
    .join("");
  await db.review.create({ data: { path: `/real-brides/${slug}/`, slug, name: d.name, html, image, status: "draft", metaDescription: null } });
  await db.contactMessage.create({ data: { name: d.name, email: d.email, subject: "Nieuw real-bride-verhaal ingestuurd", message: "Er staat een nieuw verhaal klaar in Reviews (status: concept)." } });
  return { ok: true, message: "Dankjewel voor het delen! We bekijken je verhaal en plaatsen het binnenkort." };
}
