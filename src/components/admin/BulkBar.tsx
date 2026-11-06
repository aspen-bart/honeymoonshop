"use client";
import { useActionState, useEffect, useState } from "react";
import type { ActionResult } from "./fields";
import { btn, input } from "./ui";

// Bulkacties op de producten in de tabel. De selectievakjes in de tabel horen via form="…" bij dit formulier.
export const BULK_FORM = "bulk-products";

export function BulkBar({ action, categories, brands, canDelete }: { action: (s: ActionResult, f: FormData) => Promise<ActionResult>; categories: { id: string; name: string; kind: string }[]; brands: { id: string; name: string; kind: string }[]; canDelete: boolean }) {
  const [state, formAction, pending] = useActionState(action, {});
  const [choice, setChoice] = useState("");
  const [count, setCount] = useState(0);
  useEffect(() => {
    const boxes = () => Array.from(document.querySelectorAll<HTMLInputElement>(`input[form="${BULK_FORM}"][name="ids"]`));
    const update = () => setCount(boxes().filter((b) => b.checked).length);
    document.addEventListener("change", update);
    update();
    return () => document.removeEventListener("change", update);
  }, [state]);
  const toggleAll = (on: boolean) => {
    document.querySelectorAll<HTMLInputElement>(`input[form="${BULK_FORM}"][name="ids"]`).forEach((b) => (b.checked = on));
    document.dispatchEvent(new Event("change"));
  };
  return (
    <form
      id={BULK_FORM}
      action={formAction}
      onSubmit={(e) => {
        if (choice === "delete" && !window.confirm(`Weet je zeker dat je ${count} producten wilt verwijderen? Dit kan niet ongedaan worden gemaakt.`)) e.preventDefault();
      }}
      className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white p-3"
    >
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" onChange={(e) => toggleAll(e.target.checked)} aria-label="Alles op deze pagina selecteren" /> Alles
      </label>
      <span className="text-sm text-ink-soft">{count} geselecteerd</span>
      <select name="bulk" value={choice} onChange={(e) => setChoice(e.target.value)} className={`${input} !w-auto`} aria-label="Bulkactie">
        <option value="">Bulkactie kiezen…</option>
        <option value="publish">Publiceren</option>
        <option value="draft">Naar concept</option>
        <option value="sale-on">Sale-label aan</option>
        <option value="sale-off">Sale-label uit</option>
        <option value="featured-on">Uitlichten op homepage</option>
        <option value="featured-off">Niet meer uitlichten</option>
        <option value="cat-add">Toevoegen aan categorie…</option>
        <option value="cat-remove">Verwijderen uit categorie…</option>
        <option value="brand">Merk wijzigen…</option>
        {canDelete && <option value="delete">Verwijderen</option>}
      </select>
      {(choice === "cat-add" || choice === "cat-remove") && (
        <select name="categoryId" className={`${input} !w-auto`} aria-label="Categorie" required>
          <option value="">Categorie…</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.kind === "dress" ? "jurk" : c.kind === "suit" ? "pak" : "accessoire"})
            </option>
          ))}
        </select>
      )}
      {choice === "brand" && (
        <select name="brandId" className={`${input} !w-auto`} aria-label="Merk">
          <option value="">Geen merk</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} ({b.kind === "dress" ? "jurk" : b.kind === "suit" ? "pak" : "accessoire"})
            </option>
          ))}
        </select>
      )}
      <button className={btn} disabled={pending || !choice || !count}>
        {pending ? "Bezig…" : "Toepassen"}
      </button>
      {(state.message || state.error) && (
        <span role="status" className={`text-sm ${state.error ? "text-danger" : "text-success"}`}>
          {state.error ?? state.message}
        </span>
      )}
    </form>
  );
}
