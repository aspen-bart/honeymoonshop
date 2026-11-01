import { savePage, suggestMeta } from "@/app/admin/actions/content";
import { ContentForm } from "@/components/admin/ContentForm";
import { PageHeader } from "@/components/admin/ui";
import { aiEnabled } from "@/lib/admin/product-form-data";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Nieuwe pagina" };

export default async function NewPage() {
  await requireUser("editor");
  return (
    <>
      <PageHeader title="Nieuwe pagina" />
      <ContentForm
        data={{
          title: "",
          path: "",
          html: "",
          imageName: "heroImage",
          imageAltName: "heroAlt",
          faqs: [],
          status: "draft",
          noindex: false,
          select: [{ name: "template", label: "Type pagina", value: "default", options: [{ value: "default", label: "Standaard" }, { value: "contact", label: "Met contactformulier" }, { value: "appointment", label: "Met afspraakplanner" }, { value: "newsletter", label: "Met Look Book-formulier" }] }],
        }}
        pathHint="(leeg = automatisch uit de titel, bv. /nieuwe-pagina/)"
        action={savePage.bind(null, null)}
        aiAction={suggestMeta}
        aiEnabled={await aiEnabled()}
        readOnly={false}
      />
    </>
  );
}
