"use server";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/components/admin/fields";
import { aiMetaDescription } from "@/lib/ai";
import { audit } from "@/lib/admin/audit";
import { bool, normalizePath, num, opt, pathTaken, redirectOnMove, refresh, statusOf, str } from "@/lib/admin/common";
import { cleanHtml } from "@/lib/admin/sanitize";
import { assertRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { plain, slugify } from "@/lib/text";

// Server actions voor producten, categorieën, merken, pagina's, blogs en reviews.
// Elke actie controleert de rol op de server, valideert, schoont HTML op, logt in het logboek en ververst de site.

const fail = (error: string, errors?: Record<string, string>): ActionResult => ({ error, errors });
const parseJson = <T,>(v: string, fallback: T): T => {
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
};

// ---------- AI-hulp ----------
export async function suggestMeta(form: FormData): Promise<{ text?: string; error?: string }> {
  try {
    await assertRole("editor");
    const title = str(form, "name") || str(form, "title");
    const content = plain([str(form, "descriptionHtml"), str(form, "html"), str(form, "introHtml")].join(" "));
    if (!title) return { error: "Vul eerst een titel in." };
    return { text: await aiMetaDescription(title, content || title) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "AI-voorstel mislukt" };
  }
}

// ---------- producten ----------
export async function saveProduct(id: string | null, _: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("editor");
    const kind = str(form, "kind");
    if (!["dress", "suit", "accessory"].includes(kind)) return fail("Kies een soort product.");
    const name = str(form, "name");
    if (name.length < 2) return fail("Vul een naam in.", { name: "Verplicht" });
    const base = kind === "dress" ? "/trouwjurken/" : kind === "suit" ? "/pakken/" : "/accessoires-bruid/";
    const path = normalizePath(str(form, "path") || `${base}${slugify(name)}/`);
    if (!path) return fail("Het URL-pad mag alleen kleine letters, cijfers, koppeltekens en slashes bevatten.", { path: "Ongeldig" });
    if (await pathTaken(path, id ? { table: "product", id } : undefined)) return fail("Dit URL-pad is al in gebruik.", { path: "Bestaat al" });
    const old = id ? await db.product.findUnique({ where: { id }, select: { path: true } }) : null;
    const attributes = parseJson<Record<string, string[]>>(str(form, "attributes"), {});
    const data = {
      kind,
      path,
      slug: path.split("/").filter(Boolean).pop()!,
      name,
      brandId: opt(form, "brandId"),
      articleNumber: opt(form, "articleNumber"),
      sku: opt(form, "sku"),
      descriptionHtml: cleanHtml(str(form, "descriptionHtml")),
      priceText: opt(form, "priceText"),
      priceMin: num(form, "priceMin"),
      priceMax: num(form, "priceMax"),
      price: num(form, "price"),
      images: JSON.stringify(parseJson<{ src: string; alt: string }[]>(str(form, "images"), []).filter((i) => i.src)),
      attributes: JSON.stringify(Object.fromEntries(Object.entries(attributes).filter(([, v]) => v.length))),
      sale: bool(form, "sale"),
      featured: bool(form, "featured"),
      status: statusOf(form),
      sortOrder: num(form, "sortOrder") ?? 0,
      tryOn: str(form, "tryOn") || null,
      metaTitle: opt(form, "metaTitle"),
      metaDescription: opt(form, "metaDescription"),
      categories: { set: form.getAll("categoryIds").map((c) => ({ id: String(c) })) },
    };
    if (id) {
      await db.product.update({ where: { id }, data });
      await redirectOnMove(old?.path, path);
      await audit(user, "gewijzigd", "Product", id, `${name} bijgewerkt`);
    } else {
      const created = await db.product.create({ data: { ...data, categories: { connect: data.categories.set } } });
      await audit(user, "aangemaakt", "Product", created.id, `${name} aangemaakt`);
      refresh(path, base);
      redirect(`/admin/producten/${created.id}/bewerken/?nieuw=1`);
    }
    refresh(path, old?.path, base);
    return { ok: true, message: "Opgeslagen." };
  } catch (e) {
    if ((e as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw e;
    return fail(e instanceof Error ? e.message : "Opslaan mislukt");
  }
}

export async function deleteProduct(id: string) {
  const user = await assertRole("editor");
  const p = await db.product.delete({ where: { id } });
  await audit(user, "verwijderd", "Product", id, `${p.name} verwijderd`);
  refresh(p.path);
  redirect("/admin/producten/?verwijderd=1");
}

// ---------- categorieën ----------
export async function saveCategory(id: string | null, _: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("editor");
    const name = str(form, "name");
    if (name.length < 2) return fail("Vul een naam in.");
    const path = normalizePath(str(form, "path") || `/bruid/${slugify(name)}/`);
    if (!path) return fail("Ongeldig URL-pad.");
    if (await pathTaken(path, id ? { table: "category", id } : undefined)) return fail("Dit URL-pad is al in gebruik.");
    const old = id ? await db.category.findUnique({ where: { id }, select: { path: true } }) : null;
    const data = {
      kind: ["dress", "suit"].includes(str(form, "kind")) ? str(form, "kind") : "accessory",
      path,
      name,
      introHtml: cleanHtml(str(form, "introHtml")),
      bottomHtml: cleanHtml(str(form, "bottomHtml")),
      image: opt(form, "image"),
      parentId: opt(form, "parentId") === id ? null : opt(form, "parentId"),
      sortOrder: num(form, "sortOrder") ?? 0,
      status: statusOf(form),
      metaTitle: opt(form, "metaTitle"),
      metaDescription: opt(form, "metaDescription"),
    };
    if (id) {
      await db.category.update({ where: { id }, data });
      await redirectOnMove(old?.path, path);
      await audit(user, "gewijzigd", "Categorie", id, `${name} bijgewerkt`);
    } else {
      const c = await db.category.create({ data });
      await audit(user, "aangemaakt", "Categorie", c.id, `${name} aangemaakt`);
      refresh(path);
      redirect(`/admin/categorieen/${c.id}/bewerken/?nieuw=1`);
    }
    refresh(path, old?.path);
    return { ok: true, message: "Opgeslagen." };
  } catch (e) {
    if ((e as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw e;
    return fail(e instanceof Error ? e.message : "Opslaan mislukt");
  }
}

export async function deleteCategory(id: string) {
  const user = await assertRole("editor");
  const c = await db.category.delete({ where: { id } });
  await audit(user, "verwijderd", "Categorie", id, `${c.name} verwijderd`);
  refresh(c.path);
  redirect("/admin/categorieen/?verwijderd=1");
}

// ---------- merken ----------
export async function saveBrand(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("editor");
    const id = opt(form, "id");
    const name = str(form, "name");
    const kind = ["dress", "suit", "accessory"].includes(str(form, "kind")) ? str(form, "kind") : "dress";
    if (name.length < 2) return fail("Vul een naam in.");
    const data = { name, kind, slug: slugify(str(form, "slug") || name), logo: opt(form, "logo") };
    if (id) await db.brand.update({ where: { id }, data });
    else await db.brand.create({ data });
    await audit(user, id ? "gewijzigd" : "aangemaakt", "Merk", id, `Merk ${name} ${id ? "bijgewerkt" : "aangemaakt"}`);
    refresh();
    return { ok: true, message: `Merk ${name} opgeslagen.` };
  } catch (e) {
    return fail(e instanceof Error && /Unique/.test(e.message) ? "Er bestaat al een merk met deze naam." : "Opslaan mislukt");
  }
}

export async function deleteBrand(id: string) {
  const user = await assertRole("editor");
  const b = await db.brand.delete({ where: { id } });
  await audit(user, "verwijderd", "Merk", id, `Merk ${b.name} verwijderd`);
  refresh();
  redirect("/admin/merken/?verwijderd=1");
}

// ---------- pagina's ----------
export async function savePage(id: string | null, _: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("editor");
    const title = str(form, "title");
    if (title.length < 2) return fail("Vul een titel in.");
    const path = normalizePath(str(form, "path") || `/${slugify(title)}/`);
    if (!path) return fail("Ongeldig URL-pad.");
    if (await pathTaken(path, id ? { table: "page", id } : undefined)) return fail("Dit URL-pad is al in gebruik.");
    const old = id ? await db.page.findUnique({ where: { id } }) : null;
    const templateData = { ...parseJson<Record<string, unknown>>(old?.templateData ?? "{}", {}) };
    if (form.has("bottomHtml")) templateData.bottomHtml = cleanHtml(str(form, "bottomHtml"));
    const faqs = parseJson<{ q: string; a: string }[]>(str(form, "faqs"), []).filter((f) => f.q.trim() && f.a.trim());
    const data = {
      path,
      title,
      html: cleanHtml(str(form, "html")),
      heroImage: opt(form, "heroImage"),
      heroAlt: str(form, "heroAlt"),
      faqs: JSON.stringify(faqs),
      template: old?.template ?? (["default", "contact", "appointment", "newsletter"].includes(str(form, "template")) ? str(form, "template") : "default"),
      templateData: JSON.stringify(templateData),
      status: path === "/" ? "published" : statusOf(form),
      noindex: bool(form, "noindex"),
      metaTitle: opt(form, "metaTitle"),
      metaDescription: opt(form, "metaDescription"),
      ogImage: opt(form, "heroImage"),
      publishedAt: str(form, "publishedAt") ? new Date(str(form, "publishedAt")) : (old?.publishedAt ?? new Date()),
    };
    if (old?.path === "/" && path !== "/") return fail("Het pad van de homepage kan niet worden gewijzigd.");
    if (id) {
      await db.page.update({ where: { id }, data });
      await redirectOnMove(old?.path, path);
      await audit(user, "gewijzigd", "Pagina", id, `${title} bijgewerkt`);
    } else {
      const p = await db.page.create({ data });
      await audit(user, "aangemaakt", "Pagina", p.id, `${title} aangemaakt`);
      refresh(path);
      redirect(`/admin/paginas/${p.id}/bewerken/?nieuw=1`);
    }
    refresh(path, old?.path);
    return { ok: true, message: "Opgeslagen." };
  } catch (e) {
    if ((e as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw e;
    return fail(e instanceof Error ? e.message : "Opslaan mislukt");
  }
}

export async function deletePage(id: string) {
  const user = await assertRole("editor");
  const p = await db.page.findUniqueOrThrow({ where: { id } });
  if (p.path === "/" || p.template === "listing") throw new Error("Deze pagina kan niet worden verwijderd.");
  await db.page.delete({ where: { id } });
  await audit(user, "verwijderd", "Pagina", id, `${p.title} verwijderd`);
  refresh(p.path);
  redirect("/admin/paginas/?verwijderd=1");
}

// ---------- blog ----------
export async function savePost(id: string | null, _: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("editor");
    const title = str(form, "title");
    if (title.length < 2) return fail("Vul een titel in.");
    const slug = slugify(str(form, "slug") || title);
    const old = id ? await db.post.findUnique({ where: { id } }) : null;
    // oude blogs op het hoogste niveau behouden hun pad
    const path = old && !old.path.startsWith("/blog/") && slug === old.slug ? old.path : `/blog/${slug}/`;
    if (await pathTaken(path, id ? { table: "post", id } : undefined)) return fail("Er bestaat al content met deze slug.");
    const html = cleanHtml(str(form, "html"));
    const data = {
      path,
      slug,
      title,
      html,
      excerpt: str(form, "excerpt") || plain(html).slice(0, 220),
      heroImage: opt(form, "heroImage"),
      heroAlt: str(form, "heroAlt"),
      categoryId: opt(form, "categoryId"),
      authorName: str(form, "authorName") || "Team Honeymoon shop",
      status: statusOf(form),
      metaTitle: opt(form, "metaTitle"),
      metaDescription: opt(form, "metaDescription"),
      ogImage: opt(form, "heroImage"),
      publishedAt: str(form, "publishedAt") ? new Date(str(form, "publishedAt")) : new Date(),
    };
    if (id) {
      await db.post.update({ where: { id }, data });
      await redirectOnMove(old?.path, path);
      await audit(user, "gewijzigd", "Blog", id, `${title} bijgewerkt`);
    } else {
      const p = await db.post.create({ data });
      await audit(user, "aangemaakt", "Blog", p.id, `${title} aangemaakt`);
      refresh(path, "/blog/");
      redirect(`/admin/blog/${p.id}/bewerken/?nieuw=1`);
    }
    refresh(path, old?.path, "/blog/");
    return { ok: true, message: "Opgeslagen." };
  } catch (e) {
    if ((e as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw e;
    return fail(e instanceof Error ? e.message : "Opslaan mislukt");
  }
}

export async function deletePost(id: string) {
  const user = await assertRole("editor");
  const p = await db.post.delete({ where: { id } });
  await audit(user, "verwijderd", "Blog", id, `${p.title} verwijderd`);
  refresh(p.path, "/blog/");
  redirect("/admin/blog/?verwijderd=1");
}

// ---------- reviews ----------
export async function saveReview(id: string | null, _: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const user = await assertRole("editor");
    const name = str(form, "name");
    if (name.length < 2) return fail("Vul een naam in.");
    const slug = slugify(str(form, "slug") || name);
    const path = `/real-brides/${slug}/`;
    if (await pathTaken(path, id ? { table: "review", id } : undefined)) return fail("Er bestaat al een review met deze slug.");
    const old = id ? await db.review.findUnique({ where: { id }, select: { path: true } }) : null;
    const rating = num(form, "rating");
    const data = {
      path,
      slug,
      name,
      html: cleanHtml(str(form, "html")),
      image: opt(form, "image"),
      gallery: JSON.stringify(parseJson<{ src: string }[]>(str(form, "gallery"), []).map((g) => g.src)),
      photographer: opt(form, "photographer"),
      productPaths: JSON.stringify(
        str(form, "productPaths")
          .split(/\s+/)
          .map((p) => normalizePath(p))
          .filter(Boolean),
      ),
      rating: rating && rating >= 1 && rating <= 5 ? Math.round(rating) : null,
      featured: bool(form, "featured"),
      status: statusOf(form),
      metaTitle: opt(form, "metaTitle"),
      metaDescription: opt(form, "metaDescription"),
      publishedAt: str(form, "publishedAt") ? new Date(str(form, "publishedAt")) : new Date(),
    };
    if (id) {
      await db.review.update({ where: { id }, data });
      await redirectOnMove(old?.path, path);
      await audit(user, "gewijzigd", "Review", id, `Review ${name} bijgewerkt`);
    } else {
      const r = await db.review.create({ data });
      await audit(user, "aangemaakt", "Review", r.id, `Review ${name} aangemaakt`);
      refresh(path, "/real-brides/");
      redirect(`/admin/reviews/${r.id}/bewerken/?nieuw=1`);
    }
    refresh(path, old?.path, "/real-brides/");
    return { ok: true, message: "Opgeslagen." };
  } catch (e) {
    if ((e as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw e;
    return fail(e instanceof Error ? e.message : "Opslaan mislukt");
  }
}

export async function deleteReview(id: string) {
  const user = await assertRole("editor");
  const r = await db.review.delete({ where: { id } });
  await audit(user, "verwijderd", "Review", id, `Review ${r.name} verwijderd`);
  refresh(r.path, "/real-brides/");
  redirect("/admin/reviews/?verwijderd=1");
}
