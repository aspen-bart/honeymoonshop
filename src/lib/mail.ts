import "server-only";
import { decrypt } from "./crypto";
import { getConnections, getForms, type FormKey } from "./settings";

// E-mail via SparkPost (Transmissions API). Zonder actieve connectie wordt er niets verstuurd en
// blijven aanvragen gewoon in het beheer staan. Fouten breken een formulier nooit af.

const API = { us: "https://api.sparkpost.com/api/v1", eu: "https://api.eu.sparkpost.com/api/v1" } as const;

export type Mail = { to: string | string[]; subject: string; text: string; replyTo?: string };

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Platte tekst → eenvoudige, nette HTML-mail in de huisstijl. */
function toHtml(text: string) {
  const body = esc(text)
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px">${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
  return `<!doctype html><html><body style="margin:0;background:#f6f5f8;font-family:Arial,sans-serif;color:#2b2843"><div style="max-width:560px;margin:0 auto;padding:32px 24px"><p style="font-size:13px;letter-spacing:.2em;text-transform:uppercase;color:#7a6fae;margin:0 0 24px">Honeymoon shop</p><div style="background:#fff;border-radius:16px;padding:28px;font-size:15px;line-height:1.6">${body}</div><p style="font-size:12px;color:#8a86a0;margin-top:20px">Honeymoon shop · Korte Hoogstraat 4 · Rotterdam</p></div></body></html>`;
}

export async function sendMail(mail: Mail, opts: { force?: boolean } = {}) {
  const c = (await getConnections()).sparkpost;
  if ((!c.enabled && !opts.force) || !c.keyEnc) return { sent: false, reason: "SparkPost staat uit" } as const;
  const recipients = (Array.isArray(mail.to) ? mail.to : mail.to.split(/[,;\s]+/)).filter((a) => /^\S+@\S+\.\S+$/.test(a)).map((address) => ({ address }));
  if (!recipients.length) return { sent: false, reason: "Geen geldig e-mailadres" } as const;
  const res = await fetch(`${API[c.region]}/transmissions`, {
    method: "POST",
    headers: { Authorization: decrypt(c.keyEnc), "Content-Type": "application/json" },
    body: JSON.stringify({
      options: { transactional: true, open_tracking: false, click_tracking: false },
      recipients,
      content: { from: { email: c.fromEmail, name: c.fromName }, reply_to: mail.replyTo || c.replyTo || undefined, subject: mail.subject, text: mail.text, html: toHtml(mail.text) },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { errors?: { message?: string; description?: string }[] } | null;
    throw new Error(`SparkPost ${res.status}: ${err?.errors?.[0]?.description || err?.errors?.[0]?.message || res.statusText}`);
  }
  return { sent: true } as const;
}

/** SparkPost-sleutel controleren zonder te mailen (account-info opvragen). */
export async function testSparkpost(keyEnc: string, region: "us" | "eu") {
  const res = await fetch(`${API[region]}/account`, { headers: { Authorization: decrypt(keyEnc) }, signal: AbortSignal.timeout(10_000) });
  if (res.status === 401 || res.status === 403) throw new Error("De API-sleutel wordt niet geaccepteerd (controleer sleutel, rechten en regio US/EU).");
  if (!res.ok) throw new Error(`SparkPost gaf status ${res.status}.`);
  const data = (await res.json()) as { results?: { company_name?: string; customer_id?: number } };
  return `Verbonden met SparkPost${data.results?.company_name ? ` (${data.results.company_name})` : ""}.`;
}

const fill = (tpl: string, vars: Record<string, string>) => tpl.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);

/** Na een ingevuld formulier: melding naar de winkel en eventueel een bevestiging naar de bezoeker. */
export async function notifyForm(key: FormKey, vars: Record<string, string>, details: [string, string | null | undefined][]) {
  try {
    const cfg = (await getForms())[key];
    const list = details
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");
    if (cfg.notify && cfg.to) await sendMail({ to: cfg.to, subject: fill(cfg.subject, vars), text: `${fill(cfg.subject, vars)}\n\n${list}\n\nBekijk alles in het beheer: /admin/`, replyTo: vars.email });
    if (cfg.confirm && vars.email) await sendMail({ to: vars.email, subject: fill(cfg.confirmSubject, vars), text: fill(cfg.confirmText, vars) });
  } catch (e) {
    console.error(`[mail] ${key}:`, e instanceof Error ? e.message : e);
  }
}

/** Succesmelding uit /admin/formulieren/ (of de standaardtekst). */
export async function successText(key: FormKey, vars: Record<string, string>, fallback: string) {
  const t = (await getForms())[key].successText.trim();
  return t ? fill(t, vars) : fallback;
}
