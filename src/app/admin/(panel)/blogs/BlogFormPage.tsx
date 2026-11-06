import Link from "next/link";
import { deletePost, savePost, suggestMeta } from "@/app/admin/actions/content";
import { ContentForm } from "@/components/admin/ContentForm";
import { DeleteButton } from "@/components/admin/fields";
import { Notice, PageHeader, btnSm } from "@/components/admin/ui";
import { localInput } from "@/lib/admin/common";
import { aiEnabled } from "@/lib/admin/product-form-data";
import { can, type AdminUser } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Post } from "@prisma/client";

/** Gedeeld tussen /admin/blogs/nieuw/ en /admin/blogs/[id]/bewerken/. */
export async function BlogFormPage({ post, user, created }: { post: Post | null; user: AdminUser; created?: boolean }) {
  const cats = await db.blogCategory.findMany({ orderBy: { name: "asc" } });
  return (
    <>
      <PageHeader
        title={post ? post.title : "Nieuwe blog"}
        description={post && <span className="font-mono">{post.path}</span>}
        action={
          post && (
            <Link href={post.path} target="_blank" className={btnSm}>
              Bekijk op de site ↗
            </Link>
          )
        }
      />
      {created && <Notice>Blog aangemaakt.</Notice>}
      <ContentForm
        data={{
          title: post?.title ?? "",
          slug: post?.slug ?? "",
          html: post?.html ?? "",
          excerpt: post?.excerpt ?? "",
          image: post?.heroImage,
          imageName: "heroImage",
          imageAlt: post?.heroAlt,
          imageAltName: "heroAlt",
          status: post?.status ?? "draft",
          publishedAt: localInput(post?.publishedAt ?? new Date()),
          select: [{ name: "categoryId", label: "Categorie", value: post?.categoryId ?? "", options: [{ value: "", label: "Geen categorie" }, ...cats.map((c) => ({ value: c.id, label: c.name }))] }],
          text: [{ name: "authorName", label: "Auteur", value: post?.authorName ?? "Team Honeymoon shop" }],
          metaTitle: post?.metaTitle,
          metaDescription: post?.metaDescription,
          ogImage: post?.ogImage && post.ogImage !== post.heroImage ? post.ogImage : null,
        }}
        action={savePost.bind(null, post?.id ?? null)}
        aiAction={suggestMeta}
        aiEnabled={await aiEnabled()}
        readOnly={!can(user, "editor")}
      />
      {post && can(user, "editor") && (
        <div className="mt-6 max-w-xs">
          <DeleteButton action={deletePost.bind(null, post.id)} label="Blog verwijderen" />
        </div>
      )}
    </>
  );
}
