import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteProduct, saveProduct, suggestMeta } from "@/app/admin/actions/content";
import { DeleteButton } from "@/components/admin/fields";
import { ProductForm } from "@/components/admin/ProductForm";
import { Notice, PageHeader, btnSm } from "@/components/admin/ui";
import { productFormOptions } from "@/lib/admin/product-form-data";
import { can, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { attributes, images, parse, type TryOnSpot } from "@/lib/json";

export const metadata = { title: "Product bewerken" };

export default async function EditProduct({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const p = await db.product.findUnique({ where: { id }, include: { categories: { select: { id: true } } } });
  if (!p) notFound();
  const opts = await productFormOptions();
  return (
    <>
      <PageHeader
        title={p.name}
        description={<span className="font-mono">{p.path}</span>}
        action={
          <Link href={p.path} target="_blank" className={btnSm}>
            Bekijk op de site ↗
          </Link>
        }
      />
      {sp.nieuw && <Notice>Product aangemaakt.</Notice>}
      <ProductForm
        data={{ ...p, images: images(p.images), attributes: attributes(p.attributes), categoryIds: p.categories.map((c) => c.id), tryOn: parse<TryOnSpot | null>(p.tryOn, null) }}
        action={saveProduct.bind(null, p.id)}
        aiAction={suggestMeta}
        readOnly={!can(user, "editor")}
        {...opts}
      />
      {can(user, "editor") && (
        <div className="mt-6 max-w-xs">
          <DeleteButton action={deleteProduct.bind(null, p.id)} label="Product verwijderen" />
        </div>
      )}
    </>
  );
}
