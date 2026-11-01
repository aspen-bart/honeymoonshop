import Link from "next/link";
import type { Crumb } from "@/lib/seo";

export function Breadcrumbs({ items, light = false }: { items: Crumb[]; light?: boolean }) {
  return (
    <nav aria-label="Kruimelpad" className={`text-[0.8rem] ${light ? "text-white/80" : "text-ink-soft"}`}>
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <li>
          <Link href="/" className="hover:underline">
            Home
          </Link>
        </li>
        {items.map((c, i) => (
          <li key={c.path} className="flex items-center gap-2">
            <span aria-hidden="true" className="opacity-50">
              /
            </span>
            {i === items.length - 1 ? (
              <span aria-current="page" className={light ? "text-white" : "text-ink"}>
                {c.name}
              </span>
            ) : (
              <Link href={c.path} className="hover:underline">
                {c.name}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
