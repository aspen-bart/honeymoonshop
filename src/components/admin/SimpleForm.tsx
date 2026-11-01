"use client";
import { useActionState, useTransition, useState } from "react";
import type { ActionResult } from "./fields";
import { btn, btnSm } from "./ui";

/** Compact formulier met melding, voor kleine bewerkingen (status, alt-tekst, redirect, instellingen). */
export function SimpleForm({ action, children, submitLabel = "Opslaan", className = "", readOnly }: { action: (s: ActionResult, f: FormData) => Promise<ActionResult>; children: React.ReactNode; submitLabel?: string; className?: string; readOnly?: boolean }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className={className}>
      <fieldset disabled={readOnly} className="space-y-4">
        {(state.message || state.error) && (
          <p role="status" className={`rounded-xl px-4 py-2.5 text-sm ${state.error ? "bg-danger/10 text-danger" : "bg-success/10 text-success"}`}>
            {state.error ?? state.message}
          </p>
        )}
        {children}
        {!readOnly && (
          <button className={btn} disabled={pending}>
            {pending ? "Bezig…" : submitLabel}
          </button>
        )}
      </fieldset>
    </form>
  );
}

/** Knop die een server action zonder formulier uitvoert en het resultaat toont (bv. "Verbinding testen"). */
export function ActionButton({ action, label, disabled }: { action: () => Promise<ActionResult>; label: string; disabled?: boolean }) {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<ActionResult | null>(null);
  return (
    <div className="space-y-2">
      <button type="button" className={btnSm} disabled={pending || disabled} onClick={() => start(async () => setRes(await action()))}>
        {pending ? "Bezig…" : label}
      </button>
      {res && (
        <p role="status" className={`text-xs ${res.error ? "text-danger" : "text-success"}`}>
          {res.error ?? res.message}
        </p>
      )}
    </div>
  );
}
