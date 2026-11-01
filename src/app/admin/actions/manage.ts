"use server";
import fs from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionResult } from "@/components/admin/fields";
import { GTM_ID } from "@/components/site/Gtm";
import { testAi, testAiImage } from "@/lib/ai";
import { audit } from "@/lib/admin/audit";
import { normalizePath, num, opt, refresh, str } from "@/lib/admin/common";
import { assertRole } from "@/lib/auth";
import { encrypt, maskKey } from "@/lib/crypto";
import { db } from "@/lib/db";
import { DEFAULT_APPOINTMENTS, getAppointmentSettings, getConnections, getHome, getSite, saveSetting, type OpeningHours } from "@/lib/settings";

const fail = (error: string): ActionResult => ({ error });
const isRedirect = (e: unknown) => (e as { digest?: string }).digest?.startsWith("NEXT_REDIRECT");

// ---------- afspraken ----------
export async function updateAppointment(id: string, _: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("editor");
    const status = str(form, "status");
    if (!["nieuw", "bevestigd", "afgerond", "geannuleerd"].includes(status)) return fail("Ongeldige status");
    const date = str(form, "date");
    const time = str(form, "time");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return fail("Ongeldige datum of tijd");
    const a = await db.appointment.update({ where: { id }, data: { status, date, time, internalNote: opt(form, "internalNote") } });
    await audit(user, "gewijzigd", "Afspraak", id, `Afspraak ${a.name} (${a.date} ${a.time}): ${status}`);
    revalidatePath("/admin/afspraken/");
    return { ok: true, message: "Afspraak bijgewerkt." };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Opslaan mislukt");
  }
}

export async function deleteAppointment(id: string) {
  const user = await assertRole("editor");
  const a = await db.appointment.delete({ where: { id } });
  await audit(user, "verwijderd", "Afspraak", id, `Afspraak ${a.name} verwijderd`);
  redirect("/admin/afspraken/?verwijderd=1");
}

// ---------- berichten ----------
export async function toggleMessage(id: string) {
  const user = await assertRole("editor");
  const m = await db.contactMessage.findUniqueOrThrow({ where: { id } });
  await db.contactMessage.update({ where: { id }, data: { handled: !m.handled } });
  await audit(user, "gewijzigd", "Bericht", id, `Bericht van ${m.name} ${m.handled ? "heropend" : "afgehandeld"}`);
  revalidatePath("/admin/berichten/");
}

export async function deleteMessage(id: string) {
  const user = await assertRole("editor");
  const m = await db.contactMessage.delete({ where: { id } });
  await audit(user, "verwijderd", "Bericht", id, `Bericht van ${m.name} verwijderd`);
  redirect("/admin/berichten/?verwijderd=1");
}

// ---------- media ----------
export async function updateMediaAlt(id: string, _: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("editor");
    const m = await db.media.update({ where: { id }, data: { alt: str(form, "alt").slice(0, 250) } });
    await audit(user, "gewijzigd", "Media", id, `Alt-tekst van ${m.path} bijgewerkt`);
    return { ok: true, message: "Alt-tekst opgeslagen." };
  } catch {
    return fail("Opslaan mislukt");
  }
}

export async function deleteMedia(id: string) {
  const user = await assertRole("editor");
  const m = await db.media.findUniqueOrThrow({ where: { id } });
  const used = await Promise.all([
    db.product.count({ where: { images: { contains: m.path } } }),
    db.page.count({ where: { OR: [{ html: { contains: m.path } }, { heroImage: m.path }] } }),
    db.post.count({ where: { OR: [{ html: { contains: m.path } }, { heroImage: m.path }] } }),
    db.review.count({ where: { OR: [{ image: m.path }, { gallery: { contains: m.path } }] } }),
  ]);
  if (used.some((n) => n > 0)) redirect(`/admin/media/?inGebruik=${encodeURIComponent(m.path)}`);
  await db.media.delete({ where: { id } });
  await fs.unlink(path.join(process.cwd(), "public", m.path)).catch(() => {});
  await audit(user, "verwijderd", "Media", id, `${m.path} verwijderd`);
  redirect("/admin/media/?verwijderd=1");
}

// ---------- redirects ----------
export async function saveRedirect(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("editor");
    const from = normalizePath(str(form, "from"));
    const toRaw = str(form, "to");
    const to = /^https?:\/\//.test(toRaw) ? toRaw : normalizePath(toRaw);
    if (!from || !to) return fail("Vul een geldig oud en nieuw pad in (met slash aan het eind).");
    if (from === to) return fail("Oud en nieuw pad zijn gelijk.");
    const status = num(form, "status") === 302 ? 302 : 301;
    await db.redirect.upsert({ where: { from }, create: { from, to, status }, update: { to, status } });
    await audit(user, "aangemaakt", "Redirect", null, `${from} → ${to} (${status})`);
    revalidatePath("/admin/redirects/");
    return { ok: true, message: `Redirect ${from} → ${to} opgeslagen.` };
  } catch {
    return fail("Opslaan mislukt");
  }
}

export async function deleteRedirect(id: string) {
  const user = await assertRole("editor");
  const r = await db.redirect.delete({ where: { id } });
  await audit(user, "verwijderd", "Redirect", id, `${r.from} → ${r.to} verwijderd`);
  revalidatePath("/admin/redirects/");
}

// ---------- gebruikers ----------
const userSchema = z.object({ name: z.string().trim().min(2, "Vul een naam in"), email: z.string().trim().toLowerCase().email("Ongeldig e-mailadres"), roleId: z.string().min(1, "Kies een rol"), password: z.string() });

export async function saveUser(id: string | null, _: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const me = await assertRole("admin");
    const parsed = userSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    const d = parsed.data;
    if (!id && d.password.length < 12) return fail("Kies een wachtwoord van minimaal 12 tekens.");
    if (d.password && d.password.length < 12) return fail("Een nieuw wachtwoord moet minimaal 12 tekens hebben.");
    if (id === me.id) {
      const role = await db.role.findUnique({ where: { id: d.roleId } });
      if (role?.key !== "admin") return fail("Je kunt je eigen beheerdersrol niet afnemen.");
    }
    const data = { name: d.name, email: d.email, roleId: d.roleId, ...(d.password ? { passwordHash: await bcrypt.hash(d.password, 11) } : {}) };
    if (id) {
      await db.user.update({ where: { id }, data });
      await audit(me, "gewijzigd", "Gebruiker", id, `Gebruiker ${d.name} bijgewerkt`);
    } else {
      const u = await db.user.create({ data: data as typeof data & { passwordHash: string } });
      await audit(me, "aangemaakt", "Gebruiker", u.id, `Gebruiker ${d.name} aangemaakt`);
      redirect("/admin/gebruikers/?opgeslagen=1");
    }
    revalidatePath("/admin/gebruikers/");
    return { ok: true, message: "Opgeslagen." };
  } catch (e) {
    if (isRedirect(e)) throw e;
    return fail(e instanceof Error && /Unique/.test(e.message) ? "Er bestaat al een gebruiker met dit e-mailadres." : "Opslaan mislukt");
  }
}

export async function deleteUser(id: string) {
  const me = await assertRole("admin");
  if (id === me.id) throw new Error("Je kunt jezelf niet verwijderen.");
  const u = await db.user.delete({ where: { id } });
  await audit(me, "verwijderd", "Gebruiker", id, `Gebruiker ${u.name} verwijderd`);
  redirect("/admin/gebruikers/?verwijderd=1");
}

// ---------- instellingen ----------
export async function saveSiteSettings(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("admin");
    const site = await getSite();
    const hours: OpeningHours[] = [];
    for (let i = 0; i < 7; i++) {
      const label = str(form, `h${i}_label`);
      if (!label) continue;
      hours.push({ label, days: str(form, `h${i}_days`).split(",").map(Number).filter((n) => n >= 0 && n <= 6), opens: str(form, `h${i}_opens`), closes: str(form, `h${i}_closes`) });
    }
    await saveSetting("site", {
      ...site,
      name: str(form, "name") || site.name,
      legalName: str(form, "legalName") || site.legalName,
      tagline: str(form, "tagline"),
      email: str(form, "email"),
      phone: str(form, "phone"),
      phoneIntl: str(form, "phoneIntl"),
      street: str(form, "street"),
      postalCode: str(form, "postalCode"),
      city: str(form, "city"),
      kvk: str(form, "kvk"),
      topbar: str(form, "topbar") || site.topbar,
      closedNote: str(form, "closedNote"),
      socials: { facebook: str(form, "facebook"), instagram: str(form, "instagram"), pinterest: str(form, "pinterest"), youtube: str(form, "youtube") },
      googleRating: { score: str(form, "ratingScore"), count: num(form, "ratingCount") ?? 0, url: str(form, "ratingUrl") },
      openingHours: hours.length ? hours : site.openingHours,
    });
    const home = await getHome();
    await saveSetting("home", {
      ...home,
      heroVideo: str(form, "heroVideo"),
      heroPoster: str(form, "heroPoster") || home.heroPoster,
      heroImages: str(form, "heroImages").split(/\s+/).filter((s) => s.startsWith("/uploads/")),
      heroEyebrow: str(form, "heroEyebrow"),
      heroTitle: str(form, "heroTitle") || home.heroTitle,
      heroText: str(form, "heroText"),
      brideImage: str(form, "brideImage") || home.brideImage,
      groomImage: str(form, "groomImage") || home.groomImage,
    });
    await audit(user, "gewijzigd", "Instellingen", null, "Winkelgegevens en homepage bijgewerkt");
    refresh();
    return { ok: true, message: "Instellingen opgeslagen." };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Opslaan mislukt");
  }
}

export async function saveAppointmentSettings(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("admin");
    const cur = await getAppointmentSettings();
    const types = cur.types.map((t) => {
      const slots: Record<string, string[]> = {};
      for (let d = 0; d < 7; d++) {
        const v = str(form, `${t.key}_${d}`)
          .split(/[\s,]+/)
          .filter((x) => /^\d{2}:\d{2}$/.test(x))
          .sort();
        if (v.length) slots[String(d)] = v;
      }
      return { ...t, label: str(form, `${t.key}_label`) || t.label, description: str(form, `${t.key}_description`) || t.description, durationMin: num(form, `${t.key}_duration`) ?? t.durationMin, slots };
    });
    await saveSetting("appointments", {
      ...DEFAULT_APPOINTMENTS,
      ...cur,
      types,
      capacityPerSlot: Math.max(1, num(form, "capacityPerSlot") ?? cur.capacityPerSlot),
      leadDays: Math.max(0, num(form, "leadDays") ?? cur.leadDays),
      maxDaysAhead: Math.max(14, num(form, "maxDaysAhead") ?? cur.maxDaysAhead),
      closedDates: str(form, "closedDates")
        .split(/[\s,]+/)
        .filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x))
        .sort(),
      notifyEmail: str(form, "notifyEmail"),
    });
    await audit(user, "gewijzigd", "Instellingen", null, "Afspraakinstellingen bijgewerkt");
    refresh("/afspraak-maken/");
    return { ok: true, message: "Afspraakinstellingen opgeslagen." };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Opslaan mislukt");
  }
}

// ---------- connecties ----------
export async function saveGtm(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("admin");
    const containerId = str(form, "containerId").toUpperCase();
    if (containerId && !GTM_ID.test(containerId)) return fail("Gebruik het formaat GTM-XXXXXXX.");
    const c = await getConnections();
    await saveSetting("connections", { ...c, gtm: { enabled: form.get("enabled") === "on" && !!containerId, containerId } });
    await audit(user, "gewijzigd", "Connectie", "gtm", `Google Tag Manager ${form.get("enabled") === "on" ? "aan" : "uit"} (${containerId || "geen ID"})`);
    refresh();
    return { ok: true, message: "Google Tag Manager opgeslagen." };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Opslaan mislukt");
  }
}

export async function saveAi(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("admin");
    const c = await getConnections();
    const provider = str(form, "provider") === "anthropic" ? "anthropic" : "openai";
    const key = str(form, "apiKey");
    const ai = {
      ...c.ai,
      enabled: form.get("enabled") === "on",
      provider,
      model: str(form, "model"),
      imageModel: str(form, "imageModel") || "gpt-image-1",
      ...(key ? { keyEnc: encrypt(key), keyHint: maskKey(key), lastTest: undefined } : {}),
      ...(provider !== c.ai.provider && !key ? { keyEnc: "", keyHint: "" } : {}),
    } as typeof c.ai;
    await saveSetting("connections", { ...c, ai });
    await audit(user, "gewijzigd", "Connectie", "ai", `AI-connectie bijgewerkt (${provider}${key ? ", nieuwe sleutel" : ""})`);
    revalidatePath("/admin/connecties/");
    refresh();
    return { ok: true, message: "AI-connectie opgeslagen." };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Opslaan mislukt");
  }
}

export async function testAiConnection(): Promise<ActionResult> {
  const user = await assertRole("admin");
  const c = await getConnections();
  let result: { ok: boolean; message: string };
  try {
    const answer = await testAi(c.ai);
    result = { ok: true, message: `Verbinding gelukt — antwoord: “${answer}”` };
  } catch (e) {
    result = { ok: false, message: e instanceof Error ? e.message : "Verbinding mislukt" };
  }
  await saveSetting("connections", { ...c, ai: { ...c.ai, lastTest: { ...result, at: new Date().toISOString() } } });
  await audit(user, "getest", "Connectie", "ai", result.message);
  revalidatePath("/admin/connecties/");
  return result.ok ? { ok: true, message: result.message } : { error: result.message };
}

export async function testGtm(): Promise<ActionResult> {
  await assertRole("admin");
  const c = await getConnections();
  if (!GTM_ID.test(c.gtm.containerId)) return { error: "Geen geldige container-ID ingesteld." };
  try {
    const res = await fetch(`https://www.googletagmanager.com/gtm.js?id=${c.gtm.containerId}`, { signal: AbortSignal.timeout(10_000) });
    return res.ok ? { ok: true, message: `Container ${c.gtm.containerId} gevonden bij Google.` } : { error: `Google gaf status ${res.status}: controleer of de container gepubliceerd is.` };
  } catch {
    return { error: "Google Tag Manager was niet bereikbaar vanaf de server." };
  }
}

// ---------- AI Foto (pas-tool) ----------
export async function saveAiImage(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("admin");
    const c = await getConnections();
    const key = str(form, "apiKey");
    if (key && !/^sk-/.test(key)) return fail("Een OpenAI-sleutel begint met sk-.");
    const quality = ["low", "medium", "high"].includes(str(form, "quality")) ? (str(form, "quality") as "low" | "medium" | "high") : "medium";
    const aiImage = {
      ...c.aiImage,
      enabled: form.get("enabled") === "on",
      model: str(form, "model") || "gpt-image-2.5-flare",
      quality,
      ...(key ? { keyEnc: encrypt(key), keyHint: maskKey(key), lastTest: undefined } : {}),
    };
    if (aiImage.enabled && !aiImage.keyEnc) return fail("Vul eerst een OpenAI API-sleutel in om AI Foto aan te zetten.");
    await saveSetting("connections", { ...c, aiImage });
    await audit(user, "gewijzigd", "Connectie", "aiImage", `AI Foto ${aiImage.enabled ? "aan" : "uit"} (${aiImage.model}${key ? ", nieuwe sleutel" : ""})`);
    revalidatePath("/admin/connecties/");
    refresh();
    return { ok: true, message: "AI Foto opgeslagen." };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Opslaan mislukt");
  }
}

export async function testAiImageConnection(): Promise<ActionResult> {
  const user = await assertRole("admin");
  const c = await getConnections();
  let result: { ok: boolean; message: string };
  try {
    result = { ok: true, message: await testAiImage(c.aiImage.keyEnc, c.aiImage.model) };
  } catch (e) {
    result = { ok: false, message: e instanceof Error ? e.message : "Verbinding mislukt" };
  }
  await saveSetting("connections", { ...c, aiImage: { ...c.aiImage, lastTest: { ...result, at: new Date().toISOString() } } });
  await audit(user, "getest", "Connectie", "aiImage", result.message);
  revalidatePath("/admin/connecties/");
  return result.ok ? { ok: true, message: result.message } : { error: result.message };
}
