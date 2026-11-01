import "server-only";
import { FILTERS } from "../content";
import { db } from "../db";
import { getConnections } from "../settings";

export async function aiEnabled() {
  const conn = await getConnections();
  return conn.ai.enabled && !!conn.ai.keyEnc;
}

export async function productFormOptions() {
  const [brands, categories, ai] = await Promise.all([
    db.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, kind: true } }),
    db.category.findMany({ orderBy: [{ kind: "asc" }, { sortOrder: "asc" }], select: { id: true, name: true, kind: true } }),
    aiEnabled(),
  ]);
  return { brands, categories, filters: { dress: FILTERS.dress.filter((g) => g.name !== "Merk"), suit: FILTERS.suit.filter((g) => g.name !== "Merken") }, aiEnabled: ai };
}
