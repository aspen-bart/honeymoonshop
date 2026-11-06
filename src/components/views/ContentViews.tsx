import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/Icon";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { CtaBand, PageHero, PostCard, ReviewCard, SectionHead } from "@/components/site/blocks";
import { GoogleReviews } from "@/components/site/GoogleReviews";
import { Html } from "@/components/site/Html";
import { JsonLd } from "@/components/site/JsonLd";
import { ProductCard } from "@/components/site/ProductCard";
import { PER_PAGE } from "@/lib/content";
import { db } from "@/lib/db";
import { strings } from "@/lib/json";
import { articleLd, breadcrumbLd, describe, graph, itemListLd, type Crumb } from "@/lib/seo";
import { formatDate, plain } from "@/lib/text";
import type { BlogCategory, Post, Review } from "@prisma/client";

function Pagination({ base, page, pages }: { base: string; page: number; pages: number }) {
  if (pages < 2) return null;
  const href = (n: number) => (n === 1 ? base : `${base}page/${n}/`);
  return (
    <nav aria-label="Paginering" className="mt-14 flex flex-wrap items-center justify-center gap-2">
      {page > 1 && (
        <Link href={href(page - 1)} className="btn-ghost !px-4 !py-2.5" rel="prev">
          <Icon name="arrowLeft" className="h-4 w-4" /> Vorige
        </Link>
      )}
      {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
        <Link key={n} href={href(n)} aria-current={n === page ? "page" : undefined} className={`grid h-11 w-11 place-items-center rounded-full text-sm ${n === page ? "bg-ink text-white" : "hover:bg-cream"}`}>
          {n}
        </Link>
      ))}
      {page < pages && (
        <Link href={href(page + 1)} className="btn-ghost !px-4 !py-2.5" rel="next">
          Volgende <Icon name="arrow" className="h-4 w-4" />
        </Link>
      )}
    </nav>
  );
}

export async function BlogView({ page, category }: { page: number; category: BlogCategory | null }) {
  const where = { status: "published", ...(category ? { categoryId: category.id } : {}) };
  const [total, posts, cats, listing] = await Promise.all([
    db.post.count({ where }),
    db.post.findMany({ where, orderBy: { publishedAt: "desc" }, skip: (page - 1) * PER_PAGE.blog, take: PER_PAGE.blog, include: { category: true } }),
    db.blogCategory.findMany({ orderBy: { name: "asc" } }),
    db.page.findUnique({ where: { path: "/blog/" } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE.blog));
  if (page > pages) notFound();
  const base = category ? `/blog/${category.slug}/` : "/blog/";
  const crumbs: Crumb[] = [{ name: "Blog", path: "/blog/" }, ...(category ? [{ name: category.name, path: base }] : []), ...(page > 1 ? [{ name: `Pagina ${page}`, path: `${base}page/${page}/` }] : [])];
  const [first, ...rest] = posts;
  const title = category ? `${category.name}${page > 1 ? ` – pagina ${page}` : ""}` : page > 1 ? `Blog – pagina ${page}` : listing?.title || "Blog";
  return (
    <>
      <PageHero
        title={title}
        crumbs={<Breadcrumbs items={crumbs} />}
        eyebrow="Inspiratie & tips"
        intro={category?.introHtml ? <Html html={category.introHtml} /> : !category && page === 1 && listing?.html ? <Html html={listing.html} /> : category ? `Alle artikelen over ${category.name.toLowerCase()}: tips, trends en inspiratie van team Honeymoon shop.` : "Tips, trends en inspiratie voor jullie trouwdag — van de juiste trouwjurk tot de perfecte bruidegom-look."}
      />
      <section className="container-x py-12 lg:py-16">
        <nav aria-label="Blogcategorieën" className="no-scrollbar -mx-4 mb-10 flex gap-2 overflow-x-auto px-4">
          <Link href="/blog/" aria-current={!category ? "page" : undefined} className={`shrink-0 rounded-full border px-4 py-2 text-sm ${!category ? "border-ink bg-ink text-white" : "border-ink/20 hover:border-ink"}`}>
            Alles
          </Link>
          {cats.map((c) => (
            <Link key={c.id} href={`/blog/${c.slug}/`} aria-current={category?.id === c.id ? "page" : undefined} className={`shrink-0 rounded-full border px-4 py-2 text-sm ${category?.id === c.id ? "border-ink bg-ink text-white" : "border-ink/20 hover:border-ink"}`}>
              {c.name}
            </Link>
          ))}
        </nav>
        {first && page === 1 && (
          <div className="mb-14">
            <PostCard post={first} large />
          </div>
        )}
        <div className="grid gap-x-8 gap-y-14 md:grid-cols-2 lg:grid-cols-3">
          {(page === 1 ? rest : posts).map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
        <Pagination base={base} page={page} pages={pages} />
      </section>
      <CtaBand />
      <JsonLd data={graph(breadcrumbLd(crumbs), itemListLd(title, posts.map((p) => ({ name: p.title, path: p.path }))))} />
    </>
  );
}

export async function PostView({ post }: { post: Post & { category: BlogCategory | null } }) {
  const crumbs: Crumb[] = [{ name: "Blog", path: "/blog/" }, ...(post.category ? [{ name: post.category.name, path: `/blog/${post.category.slug}/` }] : []), { name: post.title, path: post.path }];
  const related = await db.post.findMany({ where: { status: "published", id: { not: post.id }, ...(post.categoryId ? { categoryId: post.categoryId } : {}) }, orderBy: { publishedAt: "desc" }, take: 3, include: { category: true } });
  const words = plain(post.html).split(" ").length;
  return (
    <>
      <article>
        <PageHero
          title={post.title}
          image={post.heroImage}
          imageAlt={post.heroAlt}
          crumbs={<Breadcrumbs items={crumbs} light={!!post.heroImage} />}
          eyebrow={post.category?.name ?? "Blog"}
          intro={
            <p className="flex flex-wrap gap-x-4 text-base">
              <time dateTime={post.publishedAt.toISOString()}>{formatDate(post.publishedAt)}</time>
              <span>· {Math.max(1, Math.round(words / 220))} min lezen</span>
              <span>
                ·{" "}
                <Link href="/team/" className="underline underline-offset-4">
                  {post.authorName}
                </Link>
              </span>
            </p>
          }
        />
        <div className="container-x grid gap-12 py-14 lg:grid-cols-[1fr_300px] lg:py-20">
          <Html html={post.html} className="max-w-3xl" />
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div className="rounded-[1.5rem] rounded-tr-[4rem] bg-ink p-7 text-white">
              <p className="font-serif text-3xl leading-tight text-white">Op zoek naar jouw droomlook?</p>
              <p className="mt-3 text-sm text-white/80">Plan je pasafspraak: een eigen styliste en alle tijd voor jou.</p>
              <Link href="/afspraak-maken/" className="btn-white mt-5 w-full">
                Afspraak maken
              </Link>
            </div>
            <p className="mt-6 text-sm text-ink-soft">
              Bekijk ook de{" "}
              <Link href="/trouwjurken/" className="link">
                collectie trouwjurken
              </Link>{" "}
              en{" "}
              <Link href="/pakken/" className="link">
                trouwpakken
              </Link>
              .
            </p>
          </aside>
        </div>
      </article>
      {related.length > 0 && (
        <section className="bg-cream py-16 lg:py-20">
          <div className="container-x">
            <SectionHead title="Lees ook" action={<Link href="/blog/" className="btn-ghost">Alle blogs</Link>} />
            <div className="grid gap-10 md:grid-cols-3">
              {related.map((p) => (
                <PostCard key={p.id} post={p} />
              ))}
            </div>
          </div>
        </section>
      )}
      <CtaBand />
      <JsonLd data={graph(articleLd({ title: post.title, path: post.path, description: describe(post.metaDescription, post.html), image: post.heroImage, published: post.publishedAt, modified: post.updatedAt, section: post.category?.name }), breadcrumbLd(crumbs))} />
    </>
  );
}

export async function ReviewsView({ page }: { page: number }) {
  const [total, reviews, listing] = await Promise.all([
    db.review.count({ where: { status: "published" } }),
    db.review.findMany({ where: { status: "published" }, orderBy: [{ featured: "desc" }, { publishedAt: "desc" }], skip: (page - 1) * PER_PAGE.reviews, take: PER_PAGE.reviews }),
    db.page.findUnique({ where: { path: "/real-brides/" } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE.reviews));
  if (page > pages) notFound();
  const crumbs: Crumb[] = [{ name: "Real Brides & Grooms", path: "/real-brides/" }, ...(page > 1 ? [{ name: `Pagina ${page}`, path: `/real-brides/page/${page}/` }] : [])];
  const title = page > 1 ? `Real Brides & Grooms – pagina ${page}` : listing?.title || "Real Brides & Grooms";
  return (
    <>
      <PageHero
        title={title}
        crumbs={<Breadcrumbs items={crumbs} />}
        eyebrow={`${total} echte verhalen`}
        intro={listing?.html && page === 1 ? <Html html={listing.html} /> : "Bruiden en bruidegoms die hun look bij de Honeymoon shop vonden, vertellen over hun ervaring en hun grote dag."}
      />
      <GoogleReviews title="Reviews van echte bruidsparen op Google" tone="white" />
      <section className="container-x py-12 lg:py-16">
        <h2 className="mb-8 text-4xl">Hun verhalen en trouwfoto&apos;s</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {reviews.map((r) => (
            <ReviewCard key={r.id} r={r} />
          ))}
        </div>
        <Pagination base="/real-brides/" page={page} pages={pages} />
        <p className="mt-12 text-center text-ink-soft">
          Ook bij ons geslaagd?{" "}
          <Link href="/real-brides/real-brides-toevoegen/" className="link">
            Deel jouw verhaal en foto&apos;s
          </Link>
        </p>
      </section>
      <CtaBand />
      <JsonLd data={graph(breadcrumbLd(crumbs), itemListLd(title, reviews.map((r) => ({ name: r.name, path: r.path }))))} />
    </>
  );
}

export async function ReviewView({ review }: { review: Review }) {
  const crumbs: Crumb[] = [{ name: "Real Brides & Grooms", path: "/real-brides/" }, { name: review.name, path: review.path }];
  const gallery = strings(review.gallery);
  const productPaths = strings(review.productPaths);
  const [products, more] = await Promise.all([
    productPaths.length ? db.product.findMany({ where: { path: { in: productPaths }, status: "published" }, include: { brand: true } }) : Promise.resolve([]),
    db.review.findMany({ where: { status: "published", id: { not: review.id }, featured: true }, take: 4, orderBy: { publishedAt: "desc" } }),
  ]);
  return (
    <>
      <div className="container-x pt-6">
        <Breadcrumbs items={crumbs} />
      </div>
      <article className="container-x grid gap-10 py-10 lg:grid-cols-2 lg:gap-16">
        <div>
          {review.image && (
            <div className="relative aspect-[4/5] overflow-hidden rounded-[1.75rem] rounded-tr-[6rem] bg-cream-2">
              <Image src={review.image} alt={`${review.name} op hun trouwdag`} fill priority sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
            </div>
          )}
          {gallery.length > 0 && (
            <div className="mt-4 grid grid-cols-3 gap-3">
              {gallery.slice(0, 6).map((g) => (
                <div key={g} className="relative aspect-square overflow-hidden rounded-xl bg-cream-2">
                  <Image src={g} alt={`Trouwfoto van ${review.name}`} fill sizes="200px" className="object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          <p className="eyebrow text-lilac-700">Real Brides & Grooms</p>
          <h1 className="mt-3 text-5xl sm:text-6xl">{review.name}</h1>
          <p className="mt-3 text-sm text-ink-soft">
            <time dateTime={review.publishedAt.toISOString()}>{formatDate(review.publishedAt)}</time>
            {review.photographer && <> · Fotografie: {review.photographer}</>}
          </p>
          {review.html ? <Html html={review.html} className="mt-6" /> : <p className="mt-6 text-ink-soft">{review.name} vonden hun trouwlook bij de Honeymoon shop.</p>}
          {products.length > 0 && (
            <div className="mt-10">
              <h2 className="mb-5 text-3xl">Gedragen op de grote dag</h2>
              <div className="grid grid-cols-2 gap-4">
                {products.map((p) => (
                  <ProductCard key={p.id} p={p} />
                ))}
              </div>
            </div>
          )}
          <Link href="/afspraak-maken/" className="btn-primary mt-10">
            <Icon name="calendar" className="h-4 w-4" /> Plan ook jouw pasafspraak
          </Link>
        </div>
      </article>
      <GoogleReviews title="Meer bruidsparen over de Honeymoon shop" />
      {more.length > 0 && (
        <section className="bg-blush py-16">
          <div className="container-x">
            <SectionHead title="Meer real brides" action={<Link href="/real-brides/" className="btn-ghost">Alle verhalen</Link>} />
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {more.map((r) => (
                <ReviewCard key={r.id} r={r} />
              ))}
            </div>
          </div>
        </section>
      )}
      <JsonLd data={graph(breadcrumbLd(crumbs))} />
    </>
  );
}
