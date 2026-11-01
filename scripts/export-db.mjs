// Exporteert de lokale SQLite-database als PostgreSQL-script (tabellen + alle data), bv. voor Replit.
// Het script draait als één transactie op een lege database: gaat er iets mis, dan blijft de database leeg.
// Bevat wachtwoord-hashes en klantgegevens: de map export/ staat daarom in .gitignore.
// Gebruik: npm run db:export   → export/honeymoonshop-postgres.sql
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.env.DATABASE_URL ||= "file:./dev.db";
if (!process.env.DATABASE_URL.startsWith("file:")) throw new Error("Dit script leest de lokale SQLite-database (DATABASE_URL moet met file: beginnen).");

const outDir = path.join(root, "export");
const outFile = path.join(outDir, "honeymoonshop-postgres.sql");
fs.mkdirSync(outDir, { recursive: true });

// 1) Tabellen: de PostgreSQL-variant van prisma/schema.prisma
const source = fs.readFileSync(path.join(root, "prisma", "schema.prisma"), "utf8");
const pg = source.replace(/provider\s*=\s*"sqlite"/, 'provider = "postgresql"');
if (pg === source) throw new Error("Kon de SQLite-datasource in prisma/schema.prisma niet omzetten");
const tmpSchema = path.join(outDir, ".schema.postgres.prisma");
fs.writeFileSync(tmpSchema, pg);
const diff = spawnSync("npx", ["prisma", "migrate", "diff", "--from-empty", "--to-schema-datamodel", `"${tmpSchema}"`, "--script"], {
  cwd: root,
  shell: true,
  encoding: "utf8",
  maxBuffer: 1024 * 1024 * 50,
  env: { ...process.env, DATABASE_URL: "postgresql://export:export@localhost:5432/export" },
});
fs.rmSync(tmpSchema, { force: true });
if (diff.status !== 0) throw new Error(`prisma migrate diff mislukte:\n${diff.stderr}`);

// 2) Data
const db = new PrismaClient();
const lit = (v) => {
  if (v === null || v === undefined) return "NULL";
  if (v instanceof Date) return `'${v.toISOString().replace("T", " ").replace("Z", "")}'`;
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
  return `'${String(v).replace(/\u0000/g, "").replace(/'/g, "''")}'`;
};
function inserts(table, rows) {
  if (!rows.length) return `-- ${table}: geen rijen\n`;
  const cols = Object.keys(rows[0]);
  const head = `INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(", ")}) VALUES`;
  const out = [];
  for (let i = 0; i < rows.length; i += 100) {
    out.push(`${head}\n${rows.slice(i, i + 100).map((r) => `(${cols.map((c) => lit(r[c])).join(", ")})`).join(",\n")};`);
  }
  return `-- ${table}: ${rows.length} rijen\n${out.join("\n")}\n`;
}

/** Bovenliggende categorieën eerst, anders faalt de verwijzing naar parentId. */
function parentsFirst(rows) {
  const done = new Set();
  const out = [];
  let rest = rows;
  while (rest.length) {
    const ready = rest.filter((r) => !r.parentId || done.has(r.parentId));
    if (!ready.length) throw new Error("Categorieën verwijzen in een kring naar elkaar");
    for (const r of ready) {
      done.add(r.id);
      out.push(r);
    }
    rest = rest.filter((r) => !done.has(r.id));
  }
  return out;
}

const counts = {};
const add = (table, rows) => {
  counts[table] = rows.length;
  return inserts(table, rows);
};
const parts = [
  add("Role", await db.role.findMany()),
  add("User", await db.user.findMany()),
  add("AuditLog", await db.auditLog.findMany()),
  add("Setting", await db.setting.findMany()),
  add("Media", await db.media.findMany()),
  add("Redirect", await db.redirect.findMany()),
  add("Brand", await db.brand.findMany()),
  add("Category", parentsFirst(await db.category.findMany())),
  add("Product", await db.product.findMany()),
  add("Page", await db.page.findMany()),
  add("BlogCategory", await db.blogCategory.findMany()),
  add("Post", await db.post.findMany()),
  add("Review", await db.review.findMany()),
  add("Appointment", await db.appointment.findMany()),
  add("ContactMessage", await db.contactMessage.findMany()),
  add("_CategoryToProduct", await db.$queryRawUnsafe('SELECT "A", "B" FROM "_CategoryToProduct"')),
];
await db.$disconnect();

const sql = `-- Honeymoon shop: PostgreSQL-export van de lokale database (${new Date().toISOString()})
-- Importeren op een LEGE database, bv.: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f honeymoonshop-postgres.sql
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
BEGIN;

${diff.stdout}

${parts.join("\n")}
COMMIT;
`;
fs.writeFileSync(outFile, sql);
fs.writeFileSync(path.join(outDir, "counts.json"), JSON.stringify(counts, null, 2));
console.log(counts);
console.log(`Klaar: ${path.relative(root, outFile)} (${(fs.statSync(outFile).size / 1024 / 1024).toFixed(1)} MB)`);
