"use server";
import fs from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import sharp from "sharp";
import type { ActionResult } from "@/components/admin/fields";
import { audit } from "@/lib/admin/audit";
import { bool, num, opt, refresh, str } from "@/lib/admin/common";
import { importData } from "@/lib/admin/transfer";
import { assertRole } from "@/lib/auth";
import { encrypt, maskKey } from "@/lib/crypto";
import { db } from "@/lib/db";
import { attributes } from "@/lib/json";
import { sendMail, testSparkpost } from "@/lib/mail";
import { pushTicket, testPulse } from "@/lib/pulse";
import { DEFAULT_FORMS, FORM_LABELS, getConnections, getForms, getSpecs, saveSetting, type FormKey, type ProductKind } from "@/lib/settings";
import { slugify } from "@/lib/text";

// Server actions voor connecties (SparkPost, Pulse, Tag Manager-code), formulieren, SEO, tickets,
// de shop (bulkacties, prijzen, specificaties) en import. Elke actie controleert de rol en logt in het logboek.

const fail = (error: string): ActionResult => ({ error });
const msg = (e: unknown) => (e instanceof Error ? e.message : "Opslaan mislukt");
const isRedirect = (e: unknown) => (e as { digest?: string }).digest?.startsWith("NEXT_REDIRECT");

// ---------- connecties ----------
export async function saveGtmCode(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("admin");
    const c = await getConnections();
    const headCode = str(form, "headCode").slice(0, 20_000);
    const bodyCode = str(form, "bodyCode").slice(0, 20_000);
    await saveSetting("connections", { ...c, gtm: { ...c.gtm, headCode, bodyCode } });
    await audit(user, "gewijzigd", "Connectie", "gtm", `Extra Tag Manager-code bijgewerkt (${headCode.length + bodyCode.length} tekens)`);
    refresh();
    return { ok: true, message: "Extra code opgeslagen. Die wordt geladen zodra Tag Manager actief is." };
  } catch (e) {
    return fail(msg(e));
  }
}

export async function saveSparkpost(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("admin");
    const c = await getConnections();
    const key = str(form, "apiKey");
    const fromEmail = str(form, "fromEmail").toLowerCase();
    if (fromEmail && !/^\S+@\S+\.\S+$/.test(fromEmail)) return fail("Vul een geldig afzenderadres in.");
    const sparkpost = {
      ...c.sparkpost,
      enabled: bool(form, "enabled"),
      region: str(form, "region") === "us" ? ("us" as const) : ("eu" as const),
      fromEmail,
      fromName: str(form, "fromName") || "Honeymoon shop",
      replyTo: str(form, "replyTo"),
      ...(key ? { keyEnc: encrypt(key), keyHint: maskKey(key), lastTest: undefined } : {}),
    };
    if (sparkpost.enabled && !sparkpost.keyEnc) return fail("Vul eerst een SparkPost API-sleutel in.");
    await saveSetting("connections", { ...c, sparkpost });
    await audit(user, "gewijzigd", "Connectie", "sparkpost", `SparkPost ${sparkpost.enabled ? "aan" : "uit"}${key ? " (nieuwe sleutel)" : ""}`);
    revalidatePath("/admin/connecties/");
    return { ok: true, message: "SparkPost opgeslagen." };
  } catch (e) {
    return fail(msg(e));
  }
}

export async function testSparkpostConnection(): Promise<ActionResult> {
  const user = await assertRole("admin");
  const c = await getConnections();
  let result: { ok: boolean; message: string };
  try {
    result = { ok: true, message: await testSparkpost(c.sparkpost.keyEnc, c.sparkpost.region) };
  } catch (e) {
    result = { ok: false, message: msg(e) };
  }
  await saveSetting("connections", { ...c, sparkpost: { ...c.sparkpost, lastTest: { ...result, at: new Date().toISOString() } } });
  await audit(user, "getest", "Connectie", "sparkpost", result.message);
  revalidatePath("/admin/connecties/");
  return result.ok ? { ok: true, message: result.message } : { error: result.message };
}

export async function sendTestMail(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("admin");
    const to = str(form, "to") || user.email;
    await sendMail({ to, subject: "Testmail vanuit het beheer van de Honeymoon shop", text: `Hoi ${user.name},\n\nDeze testmail laat zien dat SparkPost goed is ingesteld.\n\nTeam Honeymoon shop` }, { force: true });
    await audit(user, "verstuurd", "Connectie", "sparkpost", `Testmail naar ${to}`);
    return { ok: true, message: `Testmail verstuurd naar ${to}.` };
  } catch (e) {
    return fail(msg(e));
  }
}

export async function savePulse(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("admin");
    const c = await getConnections();
    const key = str(form, "apiKey");
    const url = str(form, "url");
    if (url && !/^https:\/\//.test(url)) return fail("De Pulse-URL moet met https:// beginnen.");
    const pulse = { ...c.pulse, enabled: bool(form, "enabled"), url, projectId: str(form, "projectId"), ...(key ? { keyEnc: encrypt(key), keyHint: maskKey(key), lastTest: undefined } : {}) };
    if (pulse.enabled && !pulse.url) return fail("Vul eerst de Pulse-URL in.");
    await saveSetting("connections", { ...c, pulse });
    await audit(user, "gewijzigd", "Connectie", "pulse", `Pulse ${pulse.enabled ? "aan" : "uit"}${key ? " (nieuwe sleutel)" : ""}`);
    revalidatePath("/admin/connecties/");
    return { ok: true, message: "Pulse opgeslagen." };
  } catch (e) {
    return fail(msg(e));
  }
}

export async function testPulseConnection(): Promise<ActionResult> {
  const user = await assertRole("admin");
  const c = await getConnections();
  let result: { ok: boolean; message: string };
  try {
    result = { ok: true, message: await testPulse() };
  } catch (e) {
    result = { ok: false, message: e instanceof Error && e.name === "TimeoutError" ? "Pulse reageerde niet binnen 10 seconden." : msg(e) };
  }
  await saveSetting("connections", { ...c, pulse: { ...c.pulse, lastTest: { ...result, at: new Date().toISOString() } } });
  await audit(user, "getest", "Connectie", "pulse", result.message);
  revalidatePath("/admin/connecties/");
  return result.ok ? { ok: true, message: result.message } : { error: result.message };
}

// ---------- formulieren ----------
export async function saveFormSettings(key: FormKey, _: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("admin");
    if (!FORM_LABELS[key]) return fail("Onbekend formulier.");
    const all = await getForms();
    const to = str(form, "to");
    if (to && !to.split(/[,;\s]+/).every((a) => /^\S+@\S+\.\S+$/.test(a))) return fail("Vul geldige e-mailadressen in (scheid met een komma).");
    all[key] = {
      notify: bool(form, "notify"),
      to,
      subject: str(form, "subject") || DEFAULT_FORMS[key].subject,
      confirm: bool(form, "confirm"),
      confirmSubject: str(form, "confirmSubject") || DEFAULT_FORMS[key].confirmSubject,
      confirmText: String(form.get("confirmText") ?? "").trim() || DEFAULT_FORMS[key].confirmText,
      successText: str(form, "successText"),
    };
    await saveSetting("forms", all);
    await audit(user, "gewijzigd", "Formulier", key, `${FORM_LABELS[key].label}: instellingen bijgewerkt`);
    revalidatePath("/admin/formulieren/");
    return { ok: true, message: `${FORM_LABELS[key].label} opgeslagen.` };
  } catch (e) {
    return fail(msg(e));
  }
}

// ---------- SEO ----------
export async function saveSeoSettings(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("admin");
    const clean = (v: string) => (/content="([^"]+)"/.exec(v)?.[1] ?? v).trim();
    const robotsDisallow = str(form, "robotsDisallow")
      .split(/\s+/)
      .filter((p) => /^\/[\w\-/*?=&.]*$/.test(p));
    await saveSetting("seo", { googleVerification: clean(str(form, "googleVerification")), bingVerification: clean(str(form, "bingVerification")), robotsDisallow });
    await audit(user, "gewijzigd", "SEO", null, "Algemene SEO-instellingen bijgewerkt");
    refresh("/robots.txt");
    return { ok: true, message: "SEO-instellingen opgeslagen." };
  } catch (e) {
    return fail(msg(e));
  }
}

const META_TABLES = ["page", "post", "product", "category", "review"] as const;
type MetaTable = (typeof META_TABLES)[number];

/** Snel bewerken vanuit een overzicht: alleen meta-title en meta-description. */
export async function saveMeta(table: MetaTable, id: string, _: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("editor");
    if (!META_TABLES.includes(table)) return fail("Onbekend type.");
    const data = { metaTitle: opt(form, "metaTitle"), metaDescription: opt(form, "metaDescription") };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = (await (db[table] as any).update({ where: { id }, data, select: { path: true } })) as { path: string };
    await audit(user, "gewijzigd", "SEO", id, `Meta-gegevens van ${row.path} bijgewerkt`);
    refresh(row.path);
    revalidatePath("/admin/seo/");
    return { ok: true, message: "Opgeslagen." };
  } catch (e) {
    return fail(msg(e));
  }
}

// ---------- tickets ----------
const TICKET_TYPES = ["bug", "wijziging", "vraag", "nieuw"];
const PRIORITIES = ["laag", "normaal", "hoog", "urgent"];
const STATUSES = ["open", "in-behandeling", "wacht-op-klant", "opgelost", "gesloten"];

async function saveAttachment(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Bijlagen moeten afbeeldingen (screenshots) zijn.");
  if (file.size > 10 * 1024 * 1024) throw new Error("Een bijlage mag maximaal 10 MB zijn.");
  const dir = path.join(process.cwd(), "public", "uploads", "tickets");
  await fs.mkdir(dir, { recursive: true });
  const name = `${slugify(file.name.replace(/\.[^.]+$/, "")) || "screenshot"}-${Date.now().toString(36)}.webp`;
  await sharp(Buffer.from(await file.arrayBuffer())).rotate().resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toFile(path.join(dir, name));
  return `/uploads/tickets/${name}`;
}

async function syncTicket(id: string) {
  const t = await db.ticket.findUniqueOrThrow({ where: { id } });
  const c = await getConnections();
  if (!c.pulse.enabled) return { synced: false, error: null as string | null };
  try {
    const { id: pulseId } = await pushTicket(t);
    await db.ticket.update({ where: { id }, data: { pulseId: pulseId ?? t.pulseId ?? "verstuurd", pulseSyncedAt: new Date(), pulseError: null } });
    return { synced: true, error: null };
  } catch (e) {
    const error = e instanceof Error && e.name === "TimeoutError" ? "Pulse reageerde niet op tijd." : msg(e);
    await db.ticket.update({ where: { id }, data: { pulseError: error } });
    return { synced: false, error };
  }
}

export async function createTicket(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("viewer");
    const subject = str(form, "subject");
    const description = String(form.get("description") ?? "").trim();
    if (subject.length < 4) return fail("Geef het ticket een korte, duidelijke titel.");
    if (description.length < 10) return fail("Beschrijf wat er moet gebeuren (minimaal 10 tekens).");
    const files = form.getAll("attachments").filter((f): f is File => f instanceof File && f.size > 0).slice(0, 5);
    const attachments: string[] = [];
    for (const f of files) attachments.push(await saveAttachment(f));
    const last = await db.ticket.findFirst({ orderBy: { number: "desc" }, select: { number: true } });
    const t = await db.ticket.create({
      data: {
        number: (last?.number ?? 1000) + 1,
        subject: subject.slice(0, 160),
        description: description.slice(0, 10_000),
        type: TICKET_TYPES.includes(str(form, "type")) ? str(form, "type") : "wijziging",
        priority: PRIORITIES.includes(str(form, "priority")) ? str(form, "priority") : "normaal",
        pageUrl: opt(form, "pageUrl")?.slice(0, 500) ?? null,
        attachments: JSON.stringify(attachments),
        createdById: user.id,
        createdByName: user.name,
        createdByEmail: user.email,
      },
    });
    await audit(user, "aangemaakt", "Ticket", t.id, `Ticket #${t.number}: ${t.subject}`);
    const sync = await syncTicket(t.id);
    revalidatePath("/admin/tickets/");
    return {
      ok: true,
      message: sync.synced ? `Ticket #${t.number} aangemaakt en doorgestuurd naar Pulse.` : sync.error ? `Ticket #${t.number} aangemaakt, maar doorsturen naar Pulse mislukte: ${sync.error}` : `Ticket #${t.number} aangemaakt. (Pulse-connectie staat uit; het ticket staat in /admin/tickets/.)`,
    };
  } catch (e) {
    return fail(msg(e));
  }
}

export async function updateTicket(id: string, _: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("editor");
    const status = str(form, "status");
    const priority = str(form, "priority");
    if (!STATUSES.includes(status) || !PRIORITIES.includes(priority)) return fail("Ongeldige status of prioriteit.");
    const t = await db.ticket.update({ where: { id }, data: { status, priority, internalNote: opt(form, "internalNote") } });
    await audit(user, "gewijzigd", "Ticket", id, `Ticket #${t.number}: ${status}`);
    revalidatePath("/admin/tickets/");
    return { ok: true, message: "Ticket bijgewerkt." };
  } catch (e) {
    return fail(msg(e));
  }
}

export async function resendTicket(id: string): Promise<ActionResult> {
  const user = await assertRole("editor");
  const c = await getConnections();
  if (!c.pulse.enabled) return { error: "Zet eerst de Pulse-connectie aan in Connecties." };
  const res = await syncTicket(id);
  const t = await db.ticket.findUniqueOrThrow({ where: { id } });
  await audit(user, "verstuurd", "Ticket", id, `Ticket #${t.number} ${res.synced ? "doorgestuurd naar Pulse" : `niet doorgestuurd: ${res.error}`}`);
  revalidatePath(`/admin/tickets/${id}/`);
  return res.synced ? { ok: true, message: "Doorgestuurd naar Pulse." } : { error: res.error ?? "Doorsturen mislukt." };
}

export async function deleteTicket(id: string) {
  const user = await assertRole("admin");
  const t = await db.ticket.delete({ where: { id } });
  await audit(user, "verwijderd", "Ticket", id, `Ticket #${t.number} verwijderd`);
  redirect("/admin/tickets/?verwijderd=1");
}

// ---------- shop: bulkacties ----------
export async function bulkProducts(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("editor");
    const ids = form.getAll("ids").map(String).filter(Boolean);
    const action = str(form, "bulk");
    if (!ids.length) return fail("Selecteer eerst een of meer producten.");
    const where = { id: { in: ids } };
    let summary = "";
    switch (action) {
      case "publish":
      case "draft":
        await db.product.updateMany({ where, data: { status: action === "publish" ? "published" : "draft" } });
        summary = action === "publish" ? "gepubliceerd" : "naar concept gezet";
        break;
      case "sale-on":
      case "sale-off":
        await db.product.updateMany({ where, data: { sale: action === "sale-on" } });
        summary = action === "sale-on" ? "sale-label aan" : "sale-label uit";
        break;
      case "featured-on":
      case "featured-off":
        await db.product.updateMany({ where, data: { featured: action === "featured-on" } });
        summary = action === "featured-on" ? "uitgelicht" : "niet meer uitgelicht";
        break;
      case "cat-add":
      case "cat-remove": {
        const categoryId = str(form, "categoryId");
        const cat = await db.category.findUnique({ where: { id: categoryId } });
        if (!cat) return fail("Kies een categorie.");
        for (const id of ids) await db.product.update({ where: { id }, data: { categories: action === "cat-add" ? { connect: { id: cat.id } } : { disconnect: { id: cat.id } } } });
        summary = `${action === "cat-add" ? "toegevoegd aan" : "verwijderd uit"} ${cat.name}`;
        break;
      }
      case "brand": {
        const brandId = opt(form, "brandId");
        await db.product.updateMany({ where, data: { brandId } });
        summary = "merk gewijzigd";
        break;
      }
      case "delete": {
        await assertRole("admin");
        await db.product.deleteMany({ where });
        summary = "verwijderd";
        break;
      }
      default:
        return fail("Kies een bulkactie.");
    }
    await audit(user, "gewijzigd", "Product", null, `${ids.length} producten ${summary}`);
    refresh("/trouwjurken/", "/pakken/");
    revalidatePath("/admin/shop/producten/");
    return { ok: true, message: `${ids.length} product${ids.length === 1 ? "" : "en"} ${summary}.` };
  } catch (e) {
    return fail(msg(e));
  }
}

// ---------- shop: prijzen ----------
const priceLabel = (min: number | null, max: number | null) => (min == null ? null : max != null && max !== min ? `€${min} - €${max}` : `€${min}`);

/** Prijzentabel: alle zichtbare regels in één keer opslaan. */
export async function savePrices(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("editor");
    const ids = form.getAll("rowId").map(String);
    let changed = 0;
    for (const id of ids) {
      const cur = await db.product.findUnique({ where: { id }, select: { price: true, priceMin: true, priceMax: true, priceText: true, sale: true, kind: true } });
      if (!cur) continue;
      // uitgeschakelde velden (bv. van–tot bij accessoires) worden niet meegestuurd: dan blijft de waarde staan
      const priceMin = form.has(`${id}_min`) ? num(form, `${id}_min`) : cur.priceMin;
      const priceMax = form.has(`${id}_max`) ? num(form, `${id}_max`) : cur.priceMax;
      const price = form.has(`${id}_price`) ? num(form, `${id}_price`) : cur.price;
      let priceText = form.has(`${id}_text`) ? opt(form, `${id}_text`) : cur.priceText;
      if (bool(form, "autoText") && cur.kind !== "accessory") priceText = priceLabel(priceMin, priceMax);
      const sale = bool(form, `${id}_sale`);
      if (priceMin !== cur.priceMin || priceMax !== cur.priceMax || price !== cur.price || priceText !== cur.priceText || sale !== cur.sale) {
        await db.product.update({ where: { id }, data: { priceMin, priceMax, price, priceText, sale } });
        changed++;
      }
    }
    if (changed) await audit(user, "gewijzigd", "Prijzen", null, `Prijzen van ${changed} producten bijgewerkt`);
    refresh("/trouwjurken/", "/pakken/");
    revalidatePath("/admin/shop/prijzen/");
    return { ok: true, message: changed ? `${changed} prijs${changed === 1 ? "" : "zen"} bijgewerkt.` : "Geen wijzigingen." };
  } catch (e) {
    return fail(msg(e));
  }
}

/** Alle producten in de huidige selectie met een percentage of vast bedrag verhogen/verlagen. */
export async function adjustPrices(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("editor");
    const ids = str(form, "ids").split(",").filter(Boolean);
    const amount = num(form, "amount");
    const mode = str(form, "mode") === "euro" ? "euro" : "procent";
    const round = Math.max(0, num(form, "round") ?? 0);
    if (!ids.length) return fail("Er staan geen producten in de selectie.");
    if (!amount) return fail("Vul een percentage of bedrag in (negatief = verlagen).");
    const calc = (v: number | null) => {
      if (v == null) return null;
      let n = mode === "euro" ? v + amount : v * (1 + amount / 100);
      n = round ? Math.round(n / round) * round : Math.round(n * 100) / 100;
      return Math.max(0, n);
    };
    const rows = await db.product.findMany({ where: { id: { in: ids } }, select: { id: true, kind: true, price: true, priceMin: true, priceMax: true, priceText: true } });
    for (const r of rows) {
      const priceMin = calc(r.priceMin);
      const priceMax = calc(r.priceMax);
      await db.product.update({ where: { id: r.id }, data: { price: calc(r.price), priceMin: priceMin == null ? null : Math.round(priceMin), priceMax: priceMax == null ? null : Math.round(priceMax), priceText: r.kind === "accessory" ? r.priceText : (priceLabel(priceMin == null ? null : Math.round(priceMin), priceMax == null ? null : Math.round(priceMax)) ?? r.priceText) } });
    }
    await audit(user, "gewijzigd", "Prijzen", null, `${rows.length} prijzen aangepast met ${amount}${mode === "euro" ? " euro" : "%"}`);
    refresh("/trouwjurken/", "/pakken/");
    revalidatePath("/admin/shop/prijzen/");
    return { ok: true, message: `${rows.length} producten aangepast (${amount > 0 ? "+" : ""}${amount}${mode === "euro" ? " euro" : "%"}).` };
  } catch (e) {
    return fail(msg(e));
  }
}

// ---------- shop: specificaties ----------
export async function saveSpecFields(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("editor");
    const specs = await getSpecs();
    for (const k of ["dress", "suit", "accessory"] as ProductKind[]) {
      if (!form.has(k)) continue;
      specs[k] = [...new Set(String(form.get(k)).split("\n").map((s) => s.trim().slice(0, 40)).filter(Boolean))];
    }
    await saveSetting("specs", specs);
    await audit(user, "gewijzigd", "Specificaties", null, "Specificatievelden bijgewerkt");
    revalidatePath("/admin/shop/specificaties/");
    return { ok: true, message: "Specificatievelden opgeslagen. Ze staan nu in elk productformulier." };
  } catch (e) {
    return fail(msg(e));
  }
}

/** Een kenmerkwaarde in één keer bij alle producten hernoemen, samenvoegen of verwijderen. */
export async function renameAttribute(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("editor");
    const kind = str(form, "kind");
    const group = str(form, "group");
    const from = str(form, "from");
    const to = str(form, "to");
    if (!group || !from) return fail("Kies een kenmerk en waarde.");
    const rows = await db.product.findMany({ where: { kind, attributes: { contains: from } }, select: { id: true, attributes: true, path: true } });
    let n = 0;
    for (const r of rows) {
      const a = attributes(r.attributes);
      if (!a[group]?.includes(from)) continue;
      a[group] = [...new Set(a[group].map((v) => (v === from ? to : v)).filter(Boolean))];
      if (!a[group].length) delete a[group];
      await db.product.update({ where: { id: r.id }, data: { attributes: JSON.stringify(a) } });
      n++;
    }
    await audit(user, "gewijzigd", "Specificaties", null, `${group}: “${from}” ${to ? `→ “${to}”` : "verwijderd"} bij ${n} producten`);
    refresh(kind === "suit" ? "/pakken/" : "/trouwjurken/");
    revalidatePath("/admin/shop/specificaties/");
    return { ok: true, message: `${n} producten bijgewerkt.` };
  } catch (e) {
    return fail(msg(e));
  }
}

// ---------- import ----------
export async function runImport(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("admin");
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) return fail("Kies een exportbestand (.json of .csv).");
    if (file.size > 12 * 1024 * 1024) return fail("Het bestand is groter dan 12 MB.");
    const res = await importData(await file.text(), file.name, { type: str(form, "type"), overwrite: bool(form, "overwrite"), dryRun: bool(form, "dryRun") });
    if (!res.dryRun) {
      await audit(user, "geïmporteerd", "Import", null, `${file.name}: ${res.created} nieuw, ${res.updated} bijgewerkt, ${res.skipped} overgeslagen`);
      refresh();
    }
    return { ok: true, message: `${res.dryRun ? "Proefimport (niets opgeslagen): " : ""}${res.created} nieuw, ${res.updated} bijgewerkt, ${res.skipped} overgeslagen.${res.errors.length ? ` Let op: ${res.errors.slice(0, 3).join("; ")}` : ""}` };
  } catch (e) {
    if (isRedirect(e)) throw e;
    return fail(msg(e));
  }
}
