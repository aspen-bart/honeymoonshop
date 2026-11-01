"use client";
import { useRef, useState } from "react";
import { Icon } from "@/components/Icon";

/**
 * Horizontale rij die je kunt swipen (touch), met de muis kunt slepen en met de pijlen kunt bedienen.
 * De kinderen bepalen zelf hun breedte (bv. 3,5 kaart zichtbaar); de rij snapt per kaart.
 */
export function DragRail({ children, label }: { children: React.ReactNode; label: string }) {
  const rail = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);

  const by = (dir: 1 | -1) => {
    const el = rail.current;
    if (!el) return;
    const card = el.firstElementChild as HTMLElement | null;
    el.scrollBy({ left: dir * (card ? card.offsetWidth + 20 : el.clientWidth * 0.8), behavior: "smooth" });
  };

  return (
    <div className="relative">
      <div
        ref={rail}
        role="region"
        aria-label={label}
        tabIndex={0}
        className={`no-scrollbar -mx-4 flex gap-5 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0 ${dragging ? "cursor-grabbing select-none" : "cursor-grab snap-x snap-mandatory"}`}
        onPointerDown={(e) => {
          if (e.pointerType !== "mouse" || !rail.current) return; // touch scrolt native
          drag.current = { x: e.clientX, left: rail.current.scrollLeft, moved: false };
        }}
        onPointerMove={(e) => {
          if (!drag.current || !rail.current) return;
          const dx = e.clientX - drag.current.x;
          if (Math.abs(dx) > 5 && !drag.current.moved) {
            drag.current.moved = true;
            setDragging(true);
          }
          if (drag.current.moved) rail.current.scrollLeft = drag.current.left - dx;
        }}
        onPointerUp={() => {
          setDragging(false);
          setTimeout(() => (drag.current = null), 0);
        }}
        onPointerLeave={() => {
          setDragging(false);
          drag.current = null;
        }}
        onClickCapture={(e) => {
          // na slepen geen link openen
          if (drag.current?.moved) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        onDragStart={(e) => e.preventDefault()}
      >
        {children}
      </div>
      <div className="mt-4 hidden justify-end gap-2 sm:flex">
        <button type="button" onClick={() => by(-1)} className="grid h-11 w-11 place-items-center rounded-full border border-current/20 transition hover:bg-ink hover:text-white" aria-label="Vorige">
          <Icon name="chevronLeft" />
        </button>
        <button type="button" onClick={() => by(1)} className="grid h-11 w-11 place-items-center rounded-full border border-current/20 transition hover:bg-ink hover:text-white" aria-label="Volgende">
          <Icon name="chevronRight" />
        </button>
      </div>
    </div>
  );
}
