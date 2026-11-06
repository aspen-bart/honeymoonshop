import "server-only";
import { FILTERS } from "../content";
import { db } from "../db";
import { getConnections, getSpecs } from "../settings";

export async function aiEnabled() {
  const conn = await getConnections();
  return conn.ai.enabled && !!conn.ai.keyEnc;
}

export async function productFormOptions() {
  const [brands, categories, ai, specFields] = await Promise.all([
    db.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, kind: true } }),
    db.category.findMany({ orderBy: [{ kind: "asc" }, { sortOrder: "asc" }], select: { id: true, name: true, kind: true } }),
    aiEnabled(),
    getSpecs(),
  ]);
  return { brands, categories, filters: { dress: FILTERS.dress.filter((g) => g.name !== "Merk"), suit: FILTERS.suit.filter((g) => g.name !== "Merken") }, aiEnabled: ai, specFields };
}
