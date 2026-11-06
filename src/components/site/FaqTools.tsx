"use client";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";

// Inhoudsopgave en zoekveld voor een pagina vol veelgestelde vragen. De vragen zelf staan als gewone HTML in de
// pagina (goed vindbaar); dit component springt naar onderwerpen, markeert het actieve onderwerp en filtert.
type Topic = { id: string; text: string; count: number };

export function FaqTools({ topics, contentId }: { topics: Topic[]; contentId: string }) {
  const [active, setActive] = useState(topics[0]?.id ?? "");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<number | null>(null);

  // Actief onderwerp volgen tijdens het scrollen
  useEffect(() => {
    const els = topics.map((t) => document.getElementById(t.id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-120px 0px -60% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [topics]);

  // Zoeken: vragen die niet passen verbergen, lege onderwerpen ook
  useEffect(() => {
    const root = document.getElementById(contentId)?.querySelector(".prose-hms");
    if (!root) return;
    const term = q.trim().toLowerCase();
    let heading: HTMLElement | null = null;
    let inSection = 0;
    let total = 0;
    const close = () => {
      if (heading) heading.hidden = !!term && inSection === 0;
    };
    for (const el of Array.from(root.children) as HTMLElement[]) {
      if (el.tagName === "H2") {
        close();
        heading = el;
        inSection = 0;
        continue;
      }
      if (el.tagName === "DETAILS") {
        const match = !term || (el.textContent ?? "").toLowerCase().includes(term);
        el.hidden = !match;
        (el as HTMLDetailsElement).open = !!term && match;
        if (match) {
          inSection++;
          total++;
        }
      } else if (term) el.hidden = true;
      else el.hidden = false;
    }
    close();
    setHits(term ? total : null);
  }, [q, contentId]);

  return (
    <div className="space-y-6">
      <label className="block">
        <span className="label">Zoek een vraag</span>
        <span className="relative block">
          <Icon name="search" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-soft" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Bijv. vermaken, betalen, maten" className="field !pl-12" />
        </span>
        {hits !== null && (
          <span className="mt-2 block text-sm text-ink-soft" aria-live="polite">
            {hits === 0 ? "Geen vragen gevonden. Stel je vraag gerust via het contactformulier." : `${hits} ${hits === 1 ? "vraag" : "vragen"} gevonden`}
          </span>
        )}
      </label>
      <nav aria-label="Onderwerpen">
        <p className="eyebrow mb-3 text-ink-soft">Onderwerpen</p>
        <ul className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:block lg:space-y-1 lg:overflow-visible lg:px-0">
          {topics.map((t) => (
            <li key={t.id} className="shrink-0">
              <a
                href={`#${t.id}`}
                onClick={(e) => {
                  // Zelf scrollen: eerst het zoekfilter wissen (verborgen koppen hebben geen positie), dan naar de kop
                  e.preventDefault();
                  setQ("");
                  setActive(t.id);
                  requestAnimationFrame(() => {
                    document.getElementById(t.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                    history.replaceState(null, "", `#${t.id}`);
                  });
                }}
                aria-current={active === t.id ? "location" : undefined}
                className={`flex items-center justify-between gap-3 rounded-full border px-4 py-2 text-sm transition lg:rounded-xl lg:border-transparent lg:px-3 ${active === t.id ? "border-ink bg-ink text-white lg:bg-ink" : "border-line bg-white hover:border-ink lg:bg-transparent lg:hover:bg-white"}`}
              >
                <span className="whitespace-nowrap">{t.text}</span>
                <span className={`text-xs ${active === t.id ? "text-white/70" : "text-ink-soft"}`}>{t.count}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
