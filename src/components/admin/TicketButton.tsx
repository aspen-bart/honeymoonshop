"use client";
import { usePathname } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { createTicket } from "@/app/admin/actions/extra";
import { Icon } from "@/components/Icon";
import type { ActionResult } from "./fields";
import { btn, btnSm, input } from "./ui";

// Ticket-popup: overal in het beheer te openen (zwevende knop, of een knop met openTicket()).
// Screenshots kun je kiezen of direct plakken (Ctrl+V) in het formulier.
export const openTicket = () => window.dispatchEvent(new Event("admin:ticket"));

export function NewTicketButton({ className = btn }: { className?: string }) {
  return (
    <button type="button" className={className} onClick={openTicket}>
      + Nieuw ticket
    </button>
  );
}

export function TicketButton() {
  const pathname = usePathname() ?? "";
  const dialog = useRef<HTMLDialogElement>(null);
  const [key, setKey] = useState(0);

  useEffect(() => {
    const open = () => {
      setKey((k) => k + 1);
      dialog.current?.showModal();
    };
    window.addEventListener("admin:ticket", open);
    return () => window.removeEventListener("admin:ticket", open);
  }, []);

  if (pathname.startsWith("/admin/login")) return null;
  return (
    <>
      <button type="button" onClick={openTicket} className="fixed bottom-5 right-5 z-30 inline-flex items-center gap-2 rounded-full bg-ink px-4 py-3 text-sm font-medium text-white shadow-lg shadow-ink/20 transition hover:bg-lilac-700" aria-haspopup="dialog">
        <Icon name="mail" className="h-4 w-4" /> Ticket melden
      </button>
      <dialog ref={dialog} className="m-auto w-[min(640px,94vw)] rounded-2xl p-0 backdrop:bg-ink/60" aria-labelledby="ticket-title">
        {key > 0 && <TicketForm key={key} pathname={pathname} close={() => dialog.current?.close()} />}
      </dialog>
    </>
  );
}

/** Eigen component met key: bij elke keer openen een leeg formulier en een verse status. */
function TicketForm({ pathname, close }: { pathname: string; close: () => void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [state, action, pending] = useActionState<ActionResult, FormData>(createTicket, {});
  const [files, setFiles] = useState<File[]>([]);

  // Gekozen en geplakte bestanden in de file-input zetten, zodat ze met het formulier meegaan
  useEffect(() => {
    if (!fileInput.current) return;
    const dt = new DataTransfer();
    files.forEach((f) => dt.items.add(f));
    fileInput.current.files = dt.files;
  }, [files]);

  const onPaste = (e: React.ClipboardEvent) => {
    const imgs = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith("image/"));
    if (imgs.length) {
      e.preventDefault();
      setFiles((cur) => [...cur, ...imgs.map((f, i) => new File([f], `screenshot-${Date.now()}-${i}.png`, { type: f.type }))].slice(0, 5));
    }
  };

  return (
        <form action={action} onPaste={onPaste} className="flex max-h-[90dvh] flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-line p-5">
            <div>
              <h2 id="ticket-title" className="font-sans text-lg font-semibold">
                Ticket indienen
              </h2>
              <p className="text-sm text-ink-soft">Een fout, wijziging of vraag? Het ticket gaat direct naar Pulse.</p>
            </div>
            <button type="button" onClick={() => close()} className="rounded-full p-2 hover:bg-cream" aria-label="Sluiten">
              <Icon name="close" />
            </button>
          </div>
          <div className="space-y-4 overflow-y-auto p-5">
            {(state.message || state.error) && (
              <p role="status" className={`rounded-xl px-4 py-3 text-sm ${state.error ? "bg-danger/10 text-danger" : "bg-success/10 text-success"}`}>
                {state.error ?? state.message}
              </p>
            )}
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-ink-soft">Onderwerp</span>
              <input name="subject" required minLength={4} maxLength={160} placeholder="Bijv. prijs van jurk X klopt niet" className={input} autoFocus />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-ink-soft">Soort</span>
                <select name="type" defaultValue="wijziging" className={input}>
                  <option value="wijziging">Wijzigingsverzoek</option>
                  <option value="bug">Fout / bug</option>
                  <option value="vraag">Vraag</option>
                  <option value="nieuw">Nieuwe functie</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-ink-soft">Prioriteit</span>
                <select name="priority" defaultValue="normaal" className={input}>
                  <option value="laag">Laag</option>
                  <option value="normaal">Normaal</option>
                  <option value="hoog">Hoog</option>
                  <option value="urgent">Urgent</option>
                </select>
              </label>
            </div>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-ink-soft">Omschrijving</span>
              <textarea name="description" required minLength={10} rows={6} placeholder="Wat zie je, wat verwacht je en waar staat het?" className={input} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-ink-soft">Over welke pagina gaat het?</span>
              <input name="pageUrl" defaultValue={pathname} className={`${input} font-mono text-xs`} />
            </label>
            <div>
              <span className="mb-1.5 block text-xs font-medium text-ink-soft">Screenshots (max. 5) — kiezen, of plakken met Ctrl+V</span>
              <input ref={fileInput} type="file" name="attachments" accept="image/*" multiple className="sr-only" tabIndex={-1} aria-hidden="true" />
              <div className="flex flex-wrap gap-2">
                {files.map((f, i) => (
                  <span key={i} className="relative h-16 w-20 overflow-hidden rounded-lg border border-line">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={URL.createObjectURL(f)} alt="" className="h-full w-full object-cover" />
                    <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="absolute right-0.5 top-0.5 rounded-full bg-ink/80 px-1.5 text-xs text-white" aria-label="Screenshot verwijderen">
                      ✕
                    </button>
                  </span>
                ))}
                {files.length < 5 && (
                  <label className={`${btnSm} h-16 cursor-pointer`}>
                    <Icon name="upload" className="h-3.5 w-3.5" /> Kiezen
                    <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => setFiles([...files, ...Array.from(e.target.files ?? [])].slice(0, 5))} />
                  </label>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 border-t border-line p-4">
            <button type="button" className={btnSm} onClick={() => close()}>
              {state.ok ? "Sluiten" : "Annuleren"}
            </button>
            {!state.ok && (
              <button className={btn} disabled={pending}>
                {pending ? "Versturen…" : "Ticket versturen"}
              </button>
            )}
          </div>
        </form>
  );
}
