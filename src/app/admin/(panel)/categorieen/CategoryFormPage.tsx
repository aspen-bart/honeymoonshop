import Link from "next/link";
import { deleteCategory, saveCategory, suggestMeta } from "@/app/admin/actions/content";
import { ContentForm } from "@/components/admin/ContentForm";
import { DeleteButton } from "@/components/admin/fields";
import { Notice, PageHeader, btnSm } from "@/components/admin/ui";
import { aiEnabled } from "@/lib/admin/product-form-data";
import { can, type AdminUser } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Category } from "@prisma/client";

export async function CategoryFormPage({ category, user, created }: { category: Category | null; user: AdminUser; created?: boolean }) {
  const all = await db.category.findMany({ where: category ? { id: { not: category.id } } : {}, orderBy: { name: "asc" } });
  return (
    <>
      <PageHeader
        title={category ? category.name : "Nieuwe categorie"}
        description={category && <span className="font-mono">{category.path}</span>}
        action={
          category && (
            <Link href={category.path} target="_blank" className={btnSm}>
              Bekijk op de site ↗
            </Link>
          )
        }
      />
      {created && <Notice>Categorie aangemaakt.</Notice>}
      <ContentForm
        data={{
          title: category?.name ?? "",
          titleName: "name",
          path: category?.path ?? "",
          html: category?.introHtml ?? "",
          htmlName: "introHtml",
          htmlLabel: "Tekst boven de producten",
          extraHtml: { name: "bottomHtml", label: "Tekst onder de producten (SEO)", value: category?.bottomHtml ?? "" },
          image: category?.image,
          imageName: "image",
          status: category?.status ?? "published",
          select: [
            {
              name: "kind",
              label: "Soort",
              value: category?.kind ?? "accessory",
              options: [
                { value: "accessory", label: "Accessoires" },
                { value: "dress", label: "Collectie trouwjurken" },
                { value: "suit", label: "Collectie trouwpakken" },
              ],
            },
            { name: "parentId", label: "Bovenliggende categorie", value: category?.parentId ?? "", options: [{ value: "", label: "Geen (hoofdcategorie)" }, ...all.filter((c) => c.kind === (category?.kind ?? "accessory")).map((c) => ({ value: c.id, label: c.name }))] },
          ],
          text: [{ name: "sortOrder", label: "Volgorde", value: String(category?.sortOrder ?? 0) }],
          metaTitle: category?.metaTitle,
          metaDescription: category?.metaDescription,
        }}
        pathHint="(bv. /bruid/sluiers/ — behoud bestaande URL's voor SEO)"
        action={saveCategory.bind(null, category?.id ?? null)}
        aiAction={suggestMeta}
        aiEnabled={await aiEnabled()}
        readOnly={!can(user, "editor")}
      />
      {category && can(user, "editor") && (
        <div className="mt-6 max-w-xs">
          <DeleteButton action={deleteCategory.bind(null, category.id)} label="Categorie verwijderen" confirmText="Categorie verwijderen? Producten blijven bestaan, maar zijn niet meer aan deze categorie gekoppeld." />
        </div>
      )}
    </>
  );
}
