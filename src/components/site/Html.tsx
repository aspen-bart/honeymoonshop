import { renderHtml } from "@/lib/html";

/** Rendert opgeschoonde CMS-HTML (al gesanitized bij opslaan) met de huisstijl voor lopende tekst. */
export async function Html({ html, className = "" }: { html: string | null | undefined; className?: string }) {
  const out = await renderHtml(html);
  if (!out) return null;
  return <div className={`prose-hms ${className}`} dangerouslySetInnerHTML={{ __html: out }} />;
}
