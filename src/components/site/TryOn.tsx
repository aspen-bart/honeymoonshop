"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import type { ImageRef, TryOnSpot } from "@/lib/json";

// "Upload jezelf 🙂" — online passen.
// Met AI Foto (ChatGPT Images, in te stellen bij /admin/connecties/): na toestemming en uploaden van een selfie of
// een foto van het hele lichaam maakt de AI automatisch een foto van de bezoeker in de jurk of het pak.
// Zonder AI (of als die faalt): gezicht in het ovaal zetten en handmatig op het model plaatsen; dat gebeurt
// volledig in de browser. In beide gevallen: bewaren, delen via WhatsApp of direct een pasafspraak maken.

type Mode = "head" | "body";
type Step = "intro" | "crop" | "place" | "ai";
type Placement = { x: number; y: number; size: number; rotate: number; flip: boolean; bright: number; warm: number };

const DEFAULT_SPOT: TryOnSpot = { x: 50, y: 13, size: 15 };
const OVAL = { x: 0.17, y: 0.12, w: 0.66, h: 0.76 }; // ovaal in het uitsnijvenster (fractie van breedte/hoogte)

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function toBlob(src: string) {
  return (await fetch(src)).blob();
}

export function TryOnButton(props: { productName: string; productPath: string; kind: string; images: ImageRef[]; spot: TryOnSpot | null; appointmentHref: string; aiAvailable: boolean; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={props.className ?? "btn-lilac w-full"} aria-haspopup="dialog">
        Upload jezelf <span aria-hidden="true">🙂</span>
      </button>
      {open && <TryOnDialog {...props} onClose={() => setOpen(false)} />}
    </>
  );
}

function TryOnDialog({ productName, productPath, kind, images, spot, appointmentHref, aiAvailable, onClose }: Parameters<typeof TryOnButton>[0] & { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<Mode>("head");
  const [step, setStep] = useState<Step>("intro");
  const [photo, setPhoto] = useState<{ url: string; w: number; h: number; file: File } | null>(null);
  const [crop, setCrop] = useState({ dx: 0, dy: 0, zoom: 1 });
  const [face, setFace] = useState<string | null>(null);
  const [imgIndex, setImgIndex] = useState(0);
  const s = spot ?? DEFAULT_SPOT;
  const [place, setPlace] = useState<Placement>({ x: s.x, y: s.y, size: s.size, rotate: 0, flip: false, bright: 100, warm: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const cropStage = useRef<HTMLDivElement>(null);
  const placeStage = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);
  const isSuit = kind === "suit";
  const label = isSuit ? "pak" : kind === "dress" ? "jurk" : "look";
  const deze = isSuit ? "dit pak" : `deze ${label}`; // "dit pak", "deze jurk"
  const inDe = isSuit ? "in het pak" : `in de ${label}`;
  const useAi = aiAvailable && consent;

  useEffect(() => {
    dialog.current?.showModal();
    return () => {
      if (photo) URL.revokeObjectURL(photo.url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** AI Foto: verkleinde foto + productfoto naar onze server → OpenAI → nieuwe foto. */
  const runAi = useCallback(
    async (file: File, m: Mode) => {
      setBusy(true);
      setError(null);
      setAiResult(null);
      setStep("ai");
      try {
        const url = URL.createObjectURL(file);
        const img = await loadImage(url);
        URL.revokeObjectURL(url);
        const sc = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement("canvas");
        c.width = Math.round(img.naturalWidth * sc);
        c.height = Math.round(img.naturalHeight * sc);
        c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
        const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.9));
        const fd = new FormData();
        fd.append("photo", blob!, "foto.jpg");
        fd.append("product", productPath);
        fd.append("image", images[imgIndex]?.src ?? "");
        fd.append("mode", m);
        const res = await fetch("/api/try-on/", { method: "POST", body: fd });
        const data = (await res.json()) as { image?: string; error?: string };
        if (!res.ok || !data.image) throw new Error(data.error || "De AI kon geen foto maken.");
        setAiResult(data.image);
      } catch (e) {
        setError(`${e instanceof Error ? e.message : "Er ging iets mis."} Je kunt jezelf ook handmatig plaatsen.`);
      } finally {
        setBusy(false);
      }
    },
    [images, imgIndex, productPath],
  );

  const onFile = async (file: File | undefined) => {
    setError(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Kies een foto (JPG, PNG of HEIC).");
    if (file.size > 15 * 1024 * 1024) return setError("Deze foto is groter dan 15 MB. Kies een kleinere foto.");
    if (aiAvailable && !consent) return setError("Vink eerst aan dat je toestemming geeft, dan maken we je foto automatisch.");
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      setPhoto({ url, w: img.naturalWidth, h: img.naturalHeight, file });
      setCrop({ dx: 0, dy: 0, zoom: mode === "body" ? 2.4 : 1.1 });
      if (useAi) runAi(file, mode);
      else setStep("crop");
    } catch {
      setError("Deze foto kon niet worden geopend. Probeer een JPG of PNG.");
    }
  };

  /** Uitsnede in het ovaal → transparante PNG met zachte rand. */
  const makeFace = useCallback(async () => {
    if (!photo || !cropStage.current) return;
    const W = cropStage.current.clientWidth;
    const H = cropStage.current.clientHeight;
    const img = await loadImage(photo.url);
    const base = Math.max(W / photo.w, H / photo.h) * crop.zoom;
    const dw = photo.w * base;
    const dh = photo.h * base;
    const ox = W * OVAL.x;
    const oy = H * OVAL.y;
    const ow = W * OVAL.w;
    const oh = H * OVAL.h;
    const k = 520 / ow;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(ow * k);
    canvas.height = Math.round(oh * k);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, (W / 2 + crop.dx - dw / 2 - ox) * k, (H / 2 + crop.dy - dh / 2 - oy) * k, dw * k, dh * k);
    // zachte ovale rand: radiale gradiënt, verticaal uitgerekt tot een ellips
    ctx.globalCompositeOperation = "destination-in";
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(1, canvas.height / canvas.width);
    const r = canvas.width / 2;
    const g = ctx.createRadialGradient(0, 0, r * 0.78, 0, 0, r);
    g.addColorStop(0, "rgba(0,0,0,1)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    setFace(canvas.toDataURL("image/png"));
    setStep("place");
  }, [photo, crop]);

  /** Handmatig samengestelde look als JPEG. */
  const composite = async () => {
    if (!face) throw new Error();
    const product = await loadImage(images[imgIndex].src);
    const faceImg = await loadImage(face);
    const CW = 1140;
    const CH = 1520;
    const canvas = document.createElement("canvas");
    canvas.width = CW;
    canvas.height = CH;
    const ctx = canvas.getContext("2d")!;
    const sc = Math.max(CW / product.naturalWidth, CH / product.naturalHeight);
    ctx.drawImage(product, (CW - product.naturalWidth * sc) / 2, (CH - product.naturalHeight * sc) / 2, product.naturalWidth * sc, product.naturalHeight * sc);
    const fw = (place.size / 100) * CW;
    const fh = fw * (faceImg.naturalHeight / faceImg.naturalWidth);
    ctx.save();
    ctx.translate((place.x / 100) * CW, (place.y / 100) * CH);
    ctx.rotate((place.rotate * Math.PI) / 180);
    ctx.scale(place.flip ? -1 : 1, 1);
    if ("filter" in ctx) ctx.filter = `brightness(${place.bright}%) sepia(${place.warm}%)`;
    ctx.drawImage(faceImg, -fw / 2, -fh / 2, fw, fh);
    ctx.restore();
    ctx.filter = "none";
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "500 28px Georgia, serif";
    ctx.fillText("HONEYMOON SHOP · honeymoonshop.nl", 36, CH - 36);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.92));
    if (!blob) throw new Error();
    return blob;
  };

  const resultBlob = async () => (step === "ai" && aiResult ? toBlob(aiResult) : composite());
  const fileName = `mijn-look-${productPath.split("/").filter(Boolean).pop()}.${step === "ai" ? "png" : "jpg"}`;

  const download = async () => {
    setBusy(true);
    try {
      const blob = await resultBlob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = fileName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch {
      setError("Opslaan lukte niet. Maak anders een screenshot van je look.");
    } finally {
      setBusy(false);
    }
  };

  /** Delen via WhatsApp: op telefoons met de foto erbij (deelmenu), anders tekst + link via WhatsApp Web. */
  const shareWhatsApp = async () => {
    setShareNote(null);
    const text = isSuit ? "Wat vind je van dit super mooie pak?" : "Wat vind je van deze super mooie jurk?";
    const url = `${window.location.origin}${productPath}`;
    try {
      const blob = await resultBlob();
      const file = new File([blob], fileName, { type: blob.type || "image/jpeg" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: `${text} ${url}` });
        return;
      }
      // Desktop: WhatsApp kan via een link geen foto meekrijgen; we bewaren hem zodat je hem kunt toevoegen.
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = fileName;
      a.click();
      setShareNote("Je foto is opgeslagen: voeg hem in WhatsApp toe aan je bericht.");
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return; // delen geannuleerd
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, "_blank", "noopener,noreferrer");
  };

  // ---- slepen (uitsnede en plaatsing) ----
  const startDrag = (e: React.PointerEvent, x: number, y: number) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, startX: x, startY: y };
  };
  const moveCrop = (e: React.PointerEvent) => {
    if (!drag.current) return;
    setCrop((c) => ({ ...c, dx: drag.current!.startX + e.clientX - drag.current!.x, dy: drag.current!.startY + e.clientY - drag.current!.y }));
  };
  const movePlace = (e: React.PointerEvent) => {
    if (!drag.current || !placeStage.current) return;
    const r = placeStage.current.getBoundingClientRect();
    setPlace((p) => ({ ...p, x: drag.current!.startX + ((e.clientX - drag.current!.x) / r.width) * 100, y: drag.current!.startY + ((e.clientY - drag.current!.y) / r.height) * 100 }));
  };
  const endDrag = () => (drag.current = null);
  const nudge = (e: React.KeyboardEvent) => {
    const d = e.shiftKey ? 2 : 0.5;
    const map: Record<string, [number, number]> = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] };
    if (map[e.key]) {
      e.preventDefault();
      setPlace((p) => ({ ...p, x: p.x + map[e.key][0], y: p.y + map[e.key][1] }));
    }
  };

  const reset = () => {
    setStep("intro");
    setPhoto(null);
    setFace(null);
    setAiResult(null);
    setError(null);
    setShareNote(null);
  };

  const ResultActions = () => (
    <div className="mt-8 grid gap-3 sm:grid-cols-2">
      <a href={appointmentHref} className="btn-primary sm:col-span-2">
        <Icon name="calendar" className="h-4 w-4" /> Pas {deze} in het echt
      </a>
      <button type="button" className="btn sm:col-span-2 bg-[#25D366] text-white hover:bg-[#1da851]" onClick={shareWhatsApp} disabled={busy}>
        <Icon name="whatsapp" className="h-4 w-4" /> Deel via WhatsApp
      </button>
      <button type="button" className="btn-ghost" onClick={download} disabled={busy}>
        <Icon name="download" className="h-4 w-4" /> Bewaar mijn look
      </button>
      {step === "ai" ? (
        <button type="button" className="btn-ghost" onClick={() => photo && runAi(photo.file, mode)} disabled={busy || !photo}>
          <Icon name="sparkle" className="h-4 w-4" /> Nog een keer
        </button>
      ) : (
        <button type="button" className="btn-ghost" onClick={() => setStep("crop")}>
          Uitsnede aanpassen
        </button>
      )}
      {shareNote && <p className="text-sm text-ink-soft sm:col-span-2">{shareNote}</p>}
    </div>
  );

  // Een melding hoort bij de stap waarin hij ontstond (bv. een mislukte AI-foto); bij handmatig verder is hij weg.
  useEffect(() => {
    if (step === "crop" || step === "place") setError(null);
  }, [step]);

  const manual = step === "crop" || step === "place" || !useAi;
  const steps: [Step, string][] = manual ? [["intro", "Foto"], ["crop", "Uitsnijden"], ["place", "Passen"]] : [["intro", "Foto"], ["ai", "Jouw look"]];

  return (
    <dialog ref={dialog} onClose={onClose} aria-labelledby="tryon-title" className="m-auto max-h-[96dvh] w-[min(980px,96vw)] overflow-hidden rounded-[1.75rem] bg-white p-0 text-ink shadow-2xl backdrop:bg-ink/70 backdrop:backdrop-blur-sm">
      <div className="flex max-h-[96dvh] flex-col">
        <header className="flex items-center gap-4 border-b border-line px-5 py-4 sm:px-7">
          <div className="min-w-0 flex-1">
            <p className="eyebrow text-lilac-700">Online passen</p>
            <h2 id="tryon-title" className="truncate text-2xl sm:text-3xl">
              Upload jezelf {inDe}: {productName}
            </h2>
          </div>
          <ol className="hidden items-center gap-2 text-xs text-ink-soft md:flex" aria-label="Stappen">
            {steps.map(([k, l], i) => (
              <li key={k} className={`flex items-center gap-2 ${step === k ? "font-semibold text-ink" : ""}`} aria-current={step === k ? "step" : undefined}>
                <span className={`grid h-6 w-6 place-items-center rounded-full ${step === k ? "bg-ink text-white" : "bg-cream-2"}`}>{i + 1}</span>
                {l}
              </li>
            ))}
          </ol>
          <button type="button" onClick={() => dialog.current?.close()} className="grid h-11 w-11 place-items-center rounded-full hover:bg-cream" aria-label="Sluiten">
            <Icon name="close" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-7">
          {error && (
            <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
              <span className="flex-1">{error}</span>
              {photo && step === "ai" && (
                <button type="button" className="underline" onClick={() => setStep("crop")}>
                  Handmatig plaatsen
                </button>
              )}
            </div>
          )}

          {step === "intro" && (
            <div className="grid gap-8 md:grid-cols-[1fr_1.1fr]">
              <div className="relative hidden aspect-[3/4] overflow-hidden rounded-[1.25rem] rounded-tr-[4rem] bg-cream-2 md:block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={images[0]?.src} alt="" className="h-full w-full object-cover" />
              </div>
              <div>
                <p className="text-lg text-ink-2">
                  Benieuwd hoe {deze} jou staat? Upload een foto{aiAvailable ? " en onze AI maakt automatisch een foto van jou " + inDe : " en zet jezelf erin"}. Zo neem je alvast een voorproefje op je pasafspraak.
                </p>
                <fieldset className="mt-6">
                  <legend className="label">Wat wil je uploaden?</legend>
                  <div className="grid grid-cols-2 gap-3">
                    {(
                      [
                        ["head", "Mijn hoofd", "Een selfie of portretfoto", "user"],
                        ["body", "Mijn hele lichaam", "Een foto van top tot teen", "users"],
                      ] as const
                    ).map(([v, t, d, icon]) => (
                      <label key={v} className={`cursor-pointer rounded-2xl border-2 p-4 transition ${mode === v ? "border-ink bg-cream" : "border-line hover:border-ink/40"}`}>
                        <input type="radio" name="tryon-mode" value={v} checked={mode === v} onChange={() => setMode(v)} className="sr-only" />
                        <Icon name={icon} className="h-6 w-6 text-lilac-700" />
                        <span className="mt-2 block font-medium">{t}</span>
                        <span className="block text-sm text-ink-soft">{d}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                {aiAvailable && (
                  <label className="mt-5 flex items-start gap-3 rounded-2xl bg-lilac-100 p-4 text-sm">
                    <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--color-ink)]" />
                    <span>
                      <strong className="font-medium">Maak mijn foto automatisch met AI.</strong> Ik geef toestemming dat mijn foto eenmalig (verkleind) via de Honeymoon shop naar OpenAI wordt gestuurd om de foto te maken; hij wordt niet bewaard. Zie de{" "}
                      <a href="/privacy/" className="link">
                        privacyverklaring
                      </a>
                      .
                    </span>
                  </label>
                )}
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <label className={`btn-primary cursor-pointer ${aiAvailable && !consent ? "pointer-events-none opacity-50" : ""}`} aria-disabled={aiAvailable && !consent}>
                    <Icon name="upload" className="h-4 w-4" /> Kies een foto
                    <input type="file" accept="image/*" className="sr-only" disabled={aiAvailable && !consent} onChange={(e) => onFile(e.target.files?.[0])} />
                  </label>
                  <label className={`btn-ghost cursor-pointer ${aiAvailable && !consent ? "pointer-events-none opacity-50" : ""}`} aria-disabled={aiAvailable && !consent}>
                    <Icon name="camera" className="h-4 w-4" /> Maak een foto
                    <input type="file" accept="image/*" capture={mode === "head" ? "user" : "environment"} className="sr-only" disabled={aiAvailable && !consent} onChange={(e) => onFile(e.target.files?.[0])} />
                  </label>
                </div>
                {aiAvailable && !consent && <p className="mt-2 text-xs text-ink-soft">Vink de toestemming aan om een foto te kiezen.</p>}
                <ul className="mt-6 space-y-2 text-sm text-ink-soft">
                  <li className="flex gap-2">
                    <Icon name="check" className="h-4 w-4 shrink-0 text-success" /> {mode === "head" ? "Kijk recht in de camera, met je haar uit je gezicht en goed licht." : "Sta rechtop, van top tot teen in beeld, bij voorkeur tegen een rustige achtergrond."}
                  </li>
                  <li className="flex gap-2">
                    <Icon name="check" className="h-4 w-4 shrink-0 text-success" /> {aiAvailable ? "Je foto wordt alleen gebruikt om jouw look te maken en niet opgeslagen." : "Je foto blijft op je eigen apparaat; wij slaan niets op."}
                  </li>
                </ul>
              </div>
            </div>
          )}

          {step === "ai" && (
            <div className="grid gap-8 md:grid-cols-2">
              <div className="relative mx-auto grid aspect-[2/3] w-full max-w-md place-items-center overflow-hidden rounded-[1.25rem] rounded-tr-[4rem] bg-cream-2">
                {aiResult ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={aiResult} alt={`Jij ${inDe}: ${productName}`} className="h-full w-full object-cover" />
                ) : (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={images[imgIndex]?.src} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40 blur-sm" />
                    {busy && (
                      <div className="relative text-center" role="status">
                        <Icon name="sparkle" className="mx-auto h-12 w-12 animate-pulse text-lilac-700" />
                        <p className="mt-3 font-serif text-2xl">Je look wordt gemaakt…</p>
                        <p className="mt-1 text-sm text-ink-soft">Dit duurt meestal 20 tot 60 seconden.</p>
                      </div>
                    )}
                  </>
                )}
              </div>
              <div>
                <h3 className="text-3xl">{aiResult ? `Zo sta jij ${inDe}` : busy ? "Even geduld…" : "Dat lukte niet"}</h3>
                <p className="mt-2 text-ink-soft">Een AI-foto geeft een indruk: kleur, stof en pasvorm ervaar je pas echt tijdens je pasafspraak.</p>
                {aiResult ? (
                  <ResultActions />
                ) : (
                  !busy && (
                    <div className="mt-6 flex flex-wrap gap-3">
                      <button type="button" className="btn-primary" onClick={() => photo && runAi(photo.file, mode)}>
                        Opnieuw proberen
                      </button>
                      <button type="button" className="btn-ghost" onClick={() => setStep("crop")}>
                        Handmatig plaatsen
                      </button>
                    </div>
                  )
                )}
                {!busy && (
                  <button type="button" className="mt-4 text-sm underline" onClick={reset}>
                    Andere foto kiezen
                  </button>
                )}
              </div>
            </div>
          )}

          {step === "crop" && photo && (
            <div className="grid gap-8 md:grid-cols-[1fr_1fr]">
              <div
                ref={cropStage}
                className="relative mx-auto aspect-[4/5] w-full max-w-md touch-none select-none overflow-hidden rounded-[1.25rem] bg-ink"
                onPointerDown={(e) => startDrag(e, crop.dx, crop.dy)}
                onPointerMove={moveCrop}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onWheel={(e) => setCrop((c) => ({ ...c, zoom: Math.min(8, Math.max(0.5, c.zoom * (e.deltaY < 0 ? 1.06 : 0.94))) }))}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt="Jouw foto"
                  draggable={false}
                  className="pointer-events-none absolute left-1/2 top-1/2 max-w-none"
                  style={{
                    width: `${Math.max(1, (photo.w / photo.h) * 1.25) * 100 * crop.zoom}%`,
                    transform: `translate(calc(-50% + ${crop.dx}px), calc(-50% + ${crop.dy}px))`,
                  }}
                />
                <div className="pointer-events-none absolute rounded-[50%] border-2 border-white/90 shadow-[0_0_0_999px_rgba(43,40,67,0.62)]" style={{ left: `${OVAL.x * 100}%`, top: `${OVAL.y * 100}%`, width: `${OVAL.w * 100}%`, height: `${OVAL.h * 100}%` }} />
                <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-xs text-white">Sleep je foto · scroll of gebruik de schuif om te zoomen</p>
              </div>
              <div>
                <h3 className="text-3xl">Zet je gezicht in het ovaal</h3>
                <p className="mt-2 text-ink-soft">{mode === "body" ? "Zoom in op je gezicht in je foto: dat plaatsen we op het model." : "Schuif en zoom tot je gezicht van kin tot haarlijn in het ovaal past."}</p>
                <label className="mt-6 block">
                  <span className="label">Zoom</span>
                  <input type="range" min={0.5} max={8} step={0.01} value={crop.zoom} onChange={(e) => setCrop({ ...crop, zoom: Number(e.target.value) })} className="w-full accent-[var(--color-ink)]" />
                </label>
                <div className="mt-6 flex flex-wrap gap-3">
                  <button type="button" className="btn-primary" onClick={makeFace}>
                    Plaats {inDe} <Icon name="arrow" className="h-4 w-4" />
                  </button>
                  <button type="button" className="btn-ghost" onClick={reset}>
                    Andere foto
                  </button>
                </div>
                {aiAvailable && !consent && (
                  <p className="mt-6 rounded-2xl bg-lilac-100 p-4 text-sm">
                    <Icon name="sparkle" className="mr-1 inline h-4 w-4 text-lilac-700" /> Liever een echte foto van jou {inDe}?{" "}
                    <button type="button" className="underline" onClick={reset}>
                      Ga terug en vink “Maak mijn foto automatisch met AI” aan.
                    </button>
                  </p>
                )}
              </div>
            </div>
          )}

          {step === "place" && face && (
            <div className="grid gap-8 md:grid-cols-[1.1fr_1fr]">
              <div>
                <div ref={placeStage} className="relative mx-auto aspect-[3/4] w-full max-w-md touch-none select-none overflow-hidden rounded-[1.25rem] rounded-tr-[4rem] bg-cream-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={images[imgIndex].src} alt={images[imgIndex].alt || productName} className="pointer-events-none absolute inset-0 h-full w-full object-cover" draggable={false} />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={face}
                    alt="Jouw gezicht — sleep om te verplaatsen, of gebruik de pijltjestoetsen"
                    tabIndex={0}
                    draggable={false}
                    onKeyDown={nudge}
                    onPointerDown={(e) => startDrag(e, place.x, place.y)}
                    onPointerMove={movePlace}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    className="absolute cursor-grab active:cursor-grabbing"
                    style={{
                      left: `${place.x}%`,
                      top: `${place.y}%`,
                      width: `${place.size}%`,
                      transform: `translate(-50%, -50%) rotate(${place.rotate}deg) scaleX(${place.flip ? -1 : 1})`,
                      filter: `brightness(${place.bright}%) sepia(${place.warm}%)`,
                    }}
                  />
                </div>
                {images.length > 1 && (
                  <div className="mt-3 flex justify-center gap-2">
                    {images.slice(0, 6).map((im, i) => (
                      <button key={im.src} type="button" onClick={() => setImgIndex(i)} className={`h-16 w-12 overflow-hidden rounded-lg border-2 ${i === imgIndex ? "border-ink" : "border-transparent opacity-70"}`} aria-label={`Gebruik foto ${i + 1}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={im.src} alt="" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-3xl">Zo sta jij {inDe}</h3>
                <p className="mt-2 text-ink-soft">Sleep je gezicht op zijn plek en stem grootte, hoek en huidtint af.</p>
                <div className="mt-6 space-y-4">
                  {(
                    [
                      ["Grootte", "size", 5, 40, 0.1],
                      ["Draaien", "rotate", -30, 30, 0.5],
                      ["Helderheid", "bright", 60, 140, 1],
                      ["Warmte", "warm", 0, 60, 1],
                    ] as const
                  ).map(([l, k, min, max, st]) => (
                    <label key={k} className="block">
                      <span className="mb-1 flex justify-between text-sm font-medium">
                        {l}
                        <span className="text-ink-soft">{Math.round(place[k] as number)}</span>
                      </span>
                      <input type="range" min={min} max={max} step={st} value={place[k] as number} onChange={(e) => setPlace({ ...place, [k]: Number(e.target.value) })} className="w-full accent-[var(--color-ink)]" />
                    </label>
                  ))}
                  <button type="button" className="inline-flex items-center gap-2 text-sm underline" onClick={() => setPlace({ ...place, flip: !place.flip })}>
                    <Icon name="flip" className="h-4 w-4" /> Spiegelen
                  </button>
                </div>
                <ResultActions />
              </div>
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}
