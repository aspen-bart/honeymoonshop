import { saveProduct, suggestMeta } from "@/app/admin/actions/content";
import { ProductForm } from "@/components/admin/ProductForm";
import { PageHeader } from "@/components/admin/ui";
import { productFormOptions } from "@/lib/admin/product-form-data";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Nieuw product" };

export default async function NewProduct({ searchParams }: { searchParams: Promise<{ soort?: string }> }) {
  await requireUser("editor");
  const { soort } = await searchParams;
  const opts = await productFormOptions();
  const kind = ["dress", "suit", "accessory"].includes(soort ?? "") ? soort! : "dress";
  return (
    <>
      <PageHeader title="Nieuw product" />
      <ProductForm
        data={{ kind, name: "", path: "", brandId: null, articleNumber: null, sku: null, descriptionHtml: "", priceText: null, priceMin: null, priceMax: null, price: null, images: [], attributes: {}, categoryIds: [], sale: false, featured: false, status: "draft", sortOrder: 0, tryOn: null, metaTitle: null, metaDescription: null }}
        action={saveProduct.bind(null, null)}
        aiAction={suggestMeta}
        readOnly={false}
        {...opts}
      />
    </>
  );
}
