import Link from "next/link";
import { notFound } from "next/navigation";
import { deletePage, savePage, suggestMeta } from "@/app/admin/actions/content";
import { ContentForm } from "@/components/admin/ContentForm";
import { DeleteButton } from "@/components/admin/fields";
import { Notice, PageHeader, btnSm } from "@/components/admin/ui";
import { localInput } from "@/lib/admin/common";
import { aiEnabled } from "@/lib/admin/product-form-data";
import { can, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { faqs, parse } from "@/lib/json";

export const metadata = { title: "Pagina bewerken" };


export default async function EditPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const p = await db.page.findUnique({ where: { id } });
  if (!p) notFound();
  const data = parse<{ bottomHtml?: string }>(p.templateData, {});
  const isListing = p.template === "listing";
  return (
    <>
      <PageHeader
        title={p.title}
        description={<span className="font-mono">{p.path}</span>}
        action={
          <Link href={p.path} target="_blank" className={btnSm}>
            Bekijk op de site ↗
          </Link>
        }
      />
      {sp.nieuw && <Notice>Pagina aangemaakt.</Notice>}
      {p.path === "/" && <Notice>Dit is de homepage. De hero, video en tegels stel je in bij Instellingen; hier beheer je de introductietekst, FAQ en SEO.</Notice>}
      <ContentForm
        data={{
          title: p.title,
          path: p.path,
          pathLocked: p.path === "/" || isListing,
          html: p.html,
          htmlLabel: isListing ? "Introductie boven het overzicht" : "Tekst",
          extraHtml: isListing ? { name: "bottomHtml", label: "Tekst onder het overzicht (SEO)", value: data.bottomHtml ?? "" } : null,
          image: p.heroImage,
          imageName: "heroImage",
          imageAlt: p.heroAlt,
          imageAltName: "heroAlt",
          faqs: faqs(p.faqs),
          status: p.status,
          statusLocked: p.path === "/",
          publishedAt: localInput(p.publishedAt),
          noindex: p.noindex,
          metaTitle: p.metaTitle,
          metaDescription: p.metaDescription,
        }}
        action={savePage.bind(null, p.id)}
        aiAction={suggestMeta}
        aiEnabled={await aiEnabled()}
        readOnly={!can(user, "editor")}
      />
      {can(user, "editor") && p.path !== "/" && !isListing && (
        <div className="mt-6 max-w-xs">
          <DeleteButton action={deletePage.bind(null, p.id)} label="Pagina verwijderen" />
        </div>
      )}
    </>
  );
}
