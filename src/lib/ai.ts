import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { decrypt } from "./crypto";
import { getConnections, type Connections } from "./settings";

// Alle AI-verzoeken lopen via de eigen server; de API-sleutel komt nooit in de browser.
// - Anthropic (Claude): tekst — connectietest en meta-descriptions in het beheer.
// - OpenAI: tekst én beeld — de AI-weergave "hele lichaam" van de pas-tool gebruikt het images-edit-endpoint.

export const AI_MODELS = {
  anthropic: ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"],
  openai: [] as string[], // vrij invulbaar; kies een actueel tekstmodel van OpenAI
};

type Ai = Connections["ai"];

function ready(ai: Ai) {
  return ai.enabled && !!ai.keyEnc && !!decrypt(ai.keyEnc);
}

export async function aiTryOnAvailable() {
  const { aiImage } = await getConnections();
  return aiImage.enabled && !!aiImage.model && !!decrypt(aiImage.keyEnc);
}

export const IMAGE_MODELS = ["gpt-image-2.5-flare", "gpt-image-2.5-sunburst", "gpt-image-1"];

async function anthropicText(ai: Ai, system: string, prompt: string, maxTokens: number) {
  const client = new Anthropic({ apiKey: decrypt(ai.keyEnc), timeout: 60_000, maxRetries: 1 });
  const res = await client.beta.messages.create({
    model: ai.model || "claude-opus-5-5",
    max_tokens: maxTokens,
    system,
    output_config: { effort: "low" },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    messages: [{ role: "user", content: prompt }],
  } as unknown as Anthropic.Beta.MessageCreateParamsNonStreaming);
  if (res.stop_reason === "refusal") throw new Error("Het model weigerde dit verzoek.");
  return res.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

async function openaiText(ai: Ai, system: string, prompt: string, maxTokens: number) {
  if (!ai.model) throw new Error("Kies eerst een OpenAI-model in de connectie.");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${decrypt(ai.keyEnc)}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: ai.model, max_completion_tokens: maxTokens, messages: [{ role: "system", content: system }, { role: "user", content: prompt }] }),
    signal: AbortSignal.timeout(60_000),
  });
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[]; error?: { message?: string } };
  if (!res.ok) throw new Error(data.error?.message || `OpenAI gaf status ${res.status}`);
  return (data.choices?.[0]?.message?.content ?? "").trim();
}

export async function aiText(system: string, prompt: string, maxTokens = 1024, override?: Ai) {
  const ai = override ?? (await getConnections()).ai;
  if (!ai.keyEnc || !decrypt(ai.keyEnc)) throw new Error("Er is nog geen API-sleutel ingesteld.");
  if (!override && !ai.enabled) throw new Error("De AI-connectie staat uit.");
  return ai.provider === "anthropic" ? anthropicText(ai, system, prompt, maxTokens) : openaiText(ai, system, prompt, maxTokens);
}

/** Korte testvraag voor de knop "Verbinding testen". */
export async function testAi(ai: Ai) {
  const answer = await aiText("Je antwoordt kort, in het Nederlands.", "Antwoord met precies: verbinding gelukt", 256, { ...ai, enabled: true });
  return answer.slice(0, 120);
}

/** Meta-description (140–160 tekens) op basis van titel en inhoud van een pagina. */
export async function aiMetaDescription(title: string, content: string) {
  const text = await aiText(
    "Je bent SEO-copywriter voor de Honeymoon shop, een bruidsmodewinkel in Rotterdam (trouwjurken, trouwpakken, accessoires). Schrijf in het Nederlands, warm en concreet, zonder overdreven claims en zonder aanhalingstekens.",
    `Schrijf één meta description van 140 tot 160 tekens voor de pagina "${title}". Beschrijf wat de bezoeker vindt en eindig met een reden om te klikken. Geef alleen de tekst terug.\n\nInhoud:\n${content.slice(0, 6000)}`,
    1024,
  );
  return text.replace(/^["'“]|["'”]$/g, "").trim();
}

/**
 * AI Foto (pas-tool): foto van de bezoeker + productfoto → nieuwe foto van de bezoeker in de jurk of het pak,
 * via het OpenAI Images-edit-endpoint (ChatGPT Images). Werkt met alleen een hoofd/selfie én met een foto van het
 * hele lichaam. De foto's worden niet opgeslagen.
 */
export async function aiTryOn(person: Blob, garment: Blob, kind: string, mode: "head" | "body") {
  const { aiImage } = await getConnections();
  const key = decrypt(aiImage.keyEnc);
  if (!aiImage.enabled || !key) throw new Error("De AI-foto is niet beschikbaar.");
  const item = kind === "suit" ? "wedding suit" : "wedding dress";
  const who =
    mode === "head"
      ? `The first image only shows the person's face and head. Create a realistic full-length photo of this person, keeping their exact face, facial features, hairstyle, hair colour and skin tone, wearing the exact ${item} from the second image, in the same pose and setting as the model in the second image.`
      : `The first image shows the person's whole body. Create a realistic full-length photo of this person wearing the exact ${item} from the second image. Keep their face, hairstyle, skin tone, body shape and pose.`;
  const fd = new FormData();
  fd.append("model", aiImage.model);
  fd.append("image[]", person, "persoon.jpg");
  fd.append("image[]", garment, "kleding.webp");
  fd.append("prompt", `${who} Reproduce the ${item} faithfully: colour, fabric, lace, buttons, lapels, neckline, waistcoat, tie and silhouette. Natural, flattering photographic lighting, sharp focus. Do not add text, logos or watermarks.`);
  fd.append("size", "1024x1536");
  fd.append("quality", aiImage.quality);
  fd.append("n", "1");
  const res = await fetch("https://api.openai.com/v1/images/edits", { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: fd, signal: AbortSignal.timeout(180_000) });
  const data = (await res.json().catch(() => ({}))) as { data?: { b64_json?: string; url?: string }[]; error?: { message?: string } };
  if (!res.ok) throw new Error(data.error?.message ? `OpenAI: ${data.error.message}` : `OpenAI gaf status ${res.status}`);
  const first = data.data?.[0];
  if (first?.b64_json) return `data:image/png;base64,${first.b64_json}`;
  if (first?.url) return first.url;
  throw new Error("De AI kon geen afbeelding maken.");
}

/** Testknop: controleert sleutel en model zonder een (betaalde) afbeelding te maken. */
export async function testAiImage(keyEnc: string, model: string) {
  const key = decrypt(keyEnc);
  if (!key) throw new Error("Er is nog geen API-sleutel ingesteld.");
  const res = await fetch(`https://api.openai.com/v1/models/${encodeURIComponent(model)}`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15_000) });
  const data = (await res.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };
  if (res.status === 401) throw new Error("De API-sleutel wordt niet geaccepteerd door OpenAI.");
  if (!res.ok) throw new Error(data.error?.message ? `OpenAI: ${data.error.message}` : `OpenAI gaf status ${res.status}`);
  return `Sleutel geldig en model ${data.id ?? model} beschikbaar.`;
}
