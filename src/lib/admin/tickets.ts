// Labels voor tickets (gedeeld door overzicht en detailpagina).
export const TICKET_STATUS: Record<string, { label: string; tone: "neutral" | "success" | "warning" | "danger" | "brand" }> = {
  open: { label: "Open", tone: "brand" },
  "in-behandeling": { label: "In behandeling", tone: "warning" },
  "wacht-op-klant": { label: "Wacht op klant", tone: "neutral" },
  opgelost: { label: "Opgelost", tone: "success" },
  gesloten: { label: "Gesloten", tone: "neutral" },
};
export const TICKET_TYPE: Record<string, string> = { bug: "Fout / bug", wijziging: "Wijziging", vraag: "Vraag", nieuw: "Nieuwe functie" };
export const TICKET_PRIO: Record<string, { label: string; tone: "neutral" | "success" | "warning" | "danger" | "brand" }> = {
  laag: { label: "Laag", tone: "neutral" },
  normaal: { label: "Normaal", tone: "neutral" },
  hoog: { label: "Hoog", tone: "warning" },
  urgent: { label: "Urgent", tone: "danger" },
};
