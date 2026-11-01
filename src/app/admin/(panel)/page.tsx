import Link from "next/link";
import { Badge, Notice, PageHeader, Panel, Stat, btnSm, fmtDateTime } from "@/components/admin/ui";
import { todayNl } from "@/lib/appointments";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { GTM_ID } from "@/components/site/Gtm";
import { getAppointmentSettings, getConnections } from "@/lib/settings";

export const metadata = { title: "Dashboard" };

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const today = todayNl();
  const monthStart = new Date(`${today.slice(0, 8)}01T00:00:00Z`);
  const [pages, posts, dresses, suits, accessories, drafts, newAppts, todayAppts, weekAppts, monthRequests, unread, upcoming, logs, conn, settings] = await Promise.all([
    db.page.count({ where: { status: "published" } }),
    db.post.count({ where: { status: "published" } }),
    db.product.count({ where: { kind: "dress", status: "published" } }),
    db.product.count({ where: { kind: "suit", status: "published" } }),
    db.product.count({ where: { kind: "accessory", status: "published" } }),
    Promise.all([db.page.count({ where: { status: "draft" } }), db.post.count({ where: { status: "draft" } }), db.product.count({ where: { status: "draft" } }), db.review.count({ where: { status: "draft" } })]).then((a) => a.reduce((x, y) => x + y, 0)),
    db.appointment.count({ where: { status: "nieuw" } }),
    db.appointment.count({ where: { date: today, status: { not: "geannuleerd" } } }),
    db.appointment.count({ where: { date: { gte: today, lte: addDays(today, 6) }, status: { not: "geannuleerd" } } }),
    db.appointment.count({ where: { createdAt: { gte: monthStart } } }),
    db.contactMessage.count({ where: { handled: false } }),
    db.appointment.findMany({ where: { date: { gte: today }, status: { not: "geannuleerd" } }, orderBy: [{ date: "asc" }, { time: "asc" }], take: 8 }),
    db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
    getConnections(),
    getAppointmentSettings(),
  ]);
  const typeLabel = (k: string) => settings.types.find((t) => t.key === k)?.label ?? k;
  const connections = [
    { name: "Google Tag Manager", status: !conn.gtm.containerId ? "niet ingesteld" : !GTM_ID.test(conn.gtm.containerId) ? "fout" : conn.gtm.enabled ? "actief" : "uit" },
    { name: "AI Foto (pas-tool)", status: !conn.aiImage.keyEnc ? "niet ingesteld" : conn.aiImage.lastTest && !conn.aiImage.lastTest.ok ? "fout" : conn.aiImage.enabled ? "actief" : "uit" },
    { name: `AI tekst (${conn.ai.provider === "anthropic" ? "Anthropic" : "OpenAI"})`, status: !conn.ai.keyEnc ? "niet ingesteld" : conn.ai.lastTest && !conn.ai.lastTest.ok ? "fout" : conn.ai.enabled ? "actief" : "uit" },
  ];

  return (
    <>
      <PageHeader
        title={`Goedendag, ${user.name.split(" ")[0]}`}
        description="Het doel van de site is afspraken: hier zie je in één oogopslag wat er binnenkomt."
        action={
          user.role !== "viewer" && (
            <>
              <Link href="/admin/producten/nieuw/?soort=dress" className={btnSm}>
                + Nieuwe jurk
              </Link>
              <Link href="/admin/blog/nieuw/" className={btnSm}>
                + Nieuwe blog
              </Link>
              <Link href="/admin/paginas/nieuw/" className={btnSm}>
                + Nieuwe pagina
              </Link>
            </>
          )
        }
      />
      {sp["geen-toegang"] && <Notice tone="danger">Je hebt geen rechten voor dat onderdeel.</Notice>}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Nieuwe afspraken" value={newAppts} href="/admin/afspraken/?status=nieuw" sub="nog te bevestigen" />
        <Stat label="Afspraken vandaag" value={todayAppts} href={`/admin/afspraken/?q=${today}`} sub={`${weekAppts} deze week`} />
        <Stat label="Aanvragen deze maand" value={monthRequests} href="/admin/afspraken/" />
        <Stat label="Ongelezen berichten" value={unread} href="/admin/berichten/" />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Trouwjurken" value={dresses} href="/admin/producten/?soort=dress" />
        <Stat label="Trouwpakken" value={suits} href="/admin/producten/?soort=suit" />
        <Stat label="Accessoires" value={accessories} href="/admin/producten/?soort=accessory" />
        <Stat label="Pagina's" value={pages} href="/admin/paginas/" />
        <Stat label="Blogs" value={posts} href="/admin/blog/" />
        <Stat label="Concepten" value={drafts} sub="pagina's, blogs, producten, reviews" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel title="Eerstvolgende afspraken" className="lg:col-span-2" action={<Link href="/admin/afspraken/" className="text-sm underline">Alle afspraken</Link>}>
          {upcoming.length ? (
            <ul className="divide-y divide-line">
              {upcoming.map((a) => (
                <li key={a.id}>
                  <Link href={`/admin/afspraken/${a.id}/`} className="flex flex-wrap items-center gap-3 py-3 hover:bg-cream/50">
                    <span className="w-28 text-sm font-medium">
                      {new Intl.DateTimeFormat("nl-NL", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${a.date}T12:00:00Z`))} · {a.time}
                    </span>
                    <span className="flex-1 text-sm">
                      {a.name} <span className="text-ink-soft">— {typeLabel(a.type)}</span>
                    </span>
                    <Badge tone={a.status === "nieuw" ? "warning" : a.status === "bevestigd" ? "success" : "neutral"}>{a.status}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-soft">Nog geen afspraken gepland.</p>
          )}
        </Panel>
        <Panel title="Connecties" action={user.role === "admin" && <Link href="/admin/connecties/" className="text-sm underline">Beheren</Link>}>
          <ul className="space-y-3">
            {connections.map((c) => (
              <li key={c.name} className="flex items-center justify-between text-sm">
                {c.name}
                <Badge tone={c.status === "actief" ? "success" : c.status === "fout" ? "danger" : "neutral"}>{c.status}</Badge>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel title="Recente activiteit" className="mt-6" action={<Link href="/admin/logboek/" className="text-sm underline">Logboek</Link>}>
        {logs.length ? (
          <ul className="divide-y divide-line text-sm">
            {logs.map((l) => (
              <li key={l.id} className="flex flex-wrap gap-x-3 py-2.5">
                <span className="w-36 text-ink-soft">{fmtDateTime(l.createdAt)}</span>
                <span className="font-medium">{l.userName}</span>
                <span className="text-ink-soft">{l.action}</span>
                <span>{l.summary}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-soft">Nog geen activiteit.</p>
        )}
      </Panel>
    </>
  );
}
