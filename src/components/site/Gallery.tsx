"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import type { ImageRef } from "@/lib/json";

/** Productgalerij: grote foto's met swipe op mobiel, miniaturen en een schermvullende weergave. */
export function Gallery({ images, name }: { images: ImageRef[]; name: string }) {
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(false);
  const track = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (zoom) dialog.current?.showModal();
    else dialog.current?.close();
  }, [zoom]);

  const go = (i: number) => {
    const n = (i + images.length) % images.length;
    setIndex(n);
    track.current?.children[n]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
  };

  if (!images.length) return <div className="aspect-[3/4] rounded-tr-[5rem] bg-cream-2" />;

  return (
    <div>
      <div className="relative">
        <div
          ref={track}
          className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto rounded-[1.5rem] rounded-tr-[5rem] bg-cream-2"
          onScroll={(e) => {
            const el = e.currentTarget;
            const i = Math.round(el.scrollLeft / el.clientWidth);
            if (i !== index) setIndex(i);
          }}
        >
          {images.map((img, i) => (
            <button key={img.src} type="button" className="relative aspect-[3/4] w-full shrink-0 snap-start cursor-zoom-in" onClick={() => setZoom(true)} aria-label={`Foto ${i + 1} van ${images.length} vergroten`}>
              <Image src={img.src} alt={img.alt || `${name} – foto ${i + 1}`} fill priority={i === 0} sizes="(max-width: 1024px) 100vw, 55vw" className="object-cover" />
            </button>
          ))}
        </div>
        {images.length > 1 && (
          <>
            <button type="button" onClick={() => go(index - 1)} className="absolute left-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 shadow" aria-label="Vorige foto">
              <Icon name="chevronLeft" />
            </button>
            <button type="button" onClick={() => go(index + 1)} className="absolute right-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 shadow" aria-label="Volgende foto">
              <Icon name="chevronRight" />
            </button>
            <p className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-white/90 px-3 py-1 text-xs">
              {index + 1} / {images.length}
            </p>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar">
          {images.map((img, i) => (
            <button key={img.src} type="button" onClick={() => go(i)} aria-label={`Toon foto ${i + 1}`} aria-current={i === index} className={`relative h-24 w-[4.5rem] shrink-0 overflow-hidden rounded-xl border-2 transition ${i === index ? "border-ink" : "border-transparent opacity-70 hover:opacity-100"}`}>
              <Image src={img.src} alt="" fill sizes="80px" className="object-cover" />
            </button>
          ))}
        </div>
      )}

      <dialog ref={dialog} onClose={() => setZoom(false)} className="m-0 h-full max-h-none w-full max-w-none bg-ink/95 p-0 backdrop:bg-ink/80" aria-label={`Foto's van ${name}`}>
        <div className="relative flex h-full items-center justify-center p-4">
          <Image src={images[index].src} alt={images[index].alt || name} width={1140} height={1500} className="max-h-full w-auto object-contain" />
          <button type="button" onClick={() => setZoom(false)} className="absolute right-4 top-4 grid h-12 w-12 place-items-center rounded-full bg-white" aria-label="Sluiten">
            <Icon name="close" />
          </button>
          {images.length > 1 && (
            <>
              <button type="button" onClick={() => go(index - 1)} className="absolute left-4 grid h-12 w-12 place-items-center rounded-full bg-white" aria-label="Vorige foto">
                <Icon name="chevronLeft" />
              </button>
              <button type="button" onClick={() => go(index + 1)} className="absolute right-4 grid h-12 w-12 place-items-center rounded-full bg-white" aria-label="Volgende foto">
                <Icon name="chevronRight" />
              </button>
            </>
          )}
        </div>
      </dialog>
    </div>
  );
}
