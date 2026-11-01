import Link from "next/link";
import { deleteReview, saveReview, suggestMeta } from "@/app/admin/actions/content";
import { ContentForm } from "@/components/admin/ContentForm";
import { DeleteButton } from "@/components/admin/fields";
import { Notice, PageHeader, btnSm } from "@/components/admin/ui";
import { localInput } from "@/lib/admin/common";
import { aiEnabled } from "@/lib/admin/product-form-data";
import { can, type AdminUser } from "@/lib/auth";
import { strings } from "@/lib/json";
import type { Review } from "@prisma/client";

export async function ReviewFormPage({ review, user, created }: { review: Review | null; user: AdminUser; created?: boolean }) {
  return (
    <>
      <PageHeader
        title={review ? review.name : "Nieuwe review"}
        description={review && <span className="font-mono">{review.path}</span>}
        action={
          review && (
            <Link href={review.path} target="_blank" className={btnSm}>
              Bekijk op de site ↗
            </Link>
          )
        }
      />
      {created && <Notice>Review aangemaakt.</Notice>}
      <ContentForm
        data={{
          title: review?.name ?? "",
          titleName: "name",
          slug: review?.slug ?? "",
          html: review?.html ?? "",
          htmlLabel: "Verhaal / review",
          image: review?.image,
          imageName: "image",
          gallery: strings(review?.gallery).map((src) => ({ src, alt: "" })),
          status: review?.status ?? "draft",
          publishedAt: localInput(review?.publishedAt ?? new Date()),
          text: [
            { name: "photographer", label: "Fotograaf", value: review?.photographer ?? "" },
            { name: "productPaths", label: "Gedragen jurken/pakken", value: strings(review?.productPaths).join(" "), hint: "(URL-paden, gescheiden door spaties)" },
            { name: "rating", label: "Beoordeling (1–5)", value: review?.rating ? String(review.rating) : "", hint: "(alleen invullen als de klant zelf een score gaf)" },
          ],
          checkboxes: [{ name: "featured", label: "Uitgelicht (homepage en productpagina's)", checked: review?.featured ?? false }],
          metaTitle: review?.metaTitle,
          metaDescription: review?.metaDescription,
        }}
        action={saveReview.bind(null, review?.id ?? null)}
        aiAction={suggestMeta}
        aiEnabled={await aiEnabled()}
        readOnly={!can(user, "editor")}
      />
      {review && can(user, "editor") && (
        <div className="mt-6 max-w-xs">
          <DeleteButton action={deleteReview.bind(null, review.id)} label="Review verwijderen" />
        </div>
      )}
    </>
  );
}
