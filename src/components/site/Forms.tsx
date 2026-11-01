"use client";
import Image from "next/image";
import Link from "next/link";
import { startTransition, useActionState, useEffect, useState } from "react";
import { requestLookBook, sendContact, submitStory, type FormState } from "@/app/actions/public";
import { Icon } from "@/components/Icon";
import { useFavorites } from "./favorites";

// Openbare formulieren met validatie in de browser (required/type) én op de server (zod), duidelijke
// foutmeldingen per veld en een bevestiging na verzenden.

type Action = (s: FormState, f: FormData) => Promise<FormState>;

function useForm(fn: Action) {
  const [state, action, pending] = useActionState<FormState, FormData>(fn, { ok: false });
  const [started] = useState(() => Date.now());
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => action(fd));
  };
  return { state, pending, onSubmit, started };
}

function Hidden({ started }: { started: number }) {
  return (
    <>
      <input type="hidden" name="started" value={started} />
      <div className="hidden" aria-hidden="true">
        <label>
          Website <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
    </>
  );
}

function Field({ label, name, error, hint, textarea, ...rest }: { label: string; name: string; error?: string; hint?: string; textarea?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) {
  const props = { name, className: "field", "aria-invalid": !!error, "aria-describedby": error ? `${name}-err` : undefined };
  return (
    <label className="block">
      <span className="label">
        {label} {hint && <span className="font-normal text-ink-soft">{hint}</span>}
      </span>
      {textarea ? <textarea {...props} rows={6} required={rest.required} defaultValue={rest.defaultValue as string} placeholder={rest.placeholder} /> : <input {...props} {...rest} />}
      {error && (
        <span id={`${name}-err`} className="mt-1 block text-sm text-danger">
          {error}
        </span>
      )}
    </label>
  );
}

function Privacy({ error, text }: { error?: string; text?: React.ReactNode }) {
  return (
    <div>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="privacy" required className="mt-1 h-4 w-4 accent-[var(--color-ink)]" aria-invalid={!!error} />
        <span>
          {text ?? (
            <>
              Ik ga akkoord met de{" "}
              <Link href="/privacy/" className="link">
                privacyverklaring
              </Link>
              .
            </>
          )}
        </span>
      </label>
      {error && <p className="mt-1 text-sm text-danger">{error}</p>}
    </div>
  );
}

function Done({ message }: { message?: string }) {
  return (
    <div role="status" className="rounded-[1.5rem] bg-lilac-100 p-8 text-center">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-white">
        <Icon name="check" className="h-7 w-7 text-lilac-700" />
      </span>
      <p className="mt-4 font-serif text-3xl">{message}</p>
      <p className="mt-3 text-ink-soft">
        Ondertussen alvast inspiratie opdoen?{" "}
        <Link href="/trouwjurken/" className="link">
          Bekijk de trouwjurken
        </Link>
        .
      </p>
    </div>
  );
}

export function ContactForm() {
  const { state, pending, onSubmit, started } = useForm(sendContact);
  const [about, setAbout] = useState<{ path: string; name: string; image: string | null } | null>(null);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("over");
    if (p) fetch(`/api/product-card/?path=${encodeURIComponent(p)}`).then((r) => (r.ok ? r.json() : null)).then(setAbout);
  }, []);
  if (state.ok) return <Done message={state.message} />;
  const e = state.errors ?? {};
  return (
    <form onSubmit={onSubmit} className="grid gap-5 sm:grid-cols-2" noValidate>
      <Hidden started={started} />
      {about && (
        <div className="flex items-center gap-4 rounded-2xl bg-cream p-3 sm:col-span-2">
          {about.image && <Image src={about.image} alt="" width={48} height={64} className="h-16 w-12 rounded-lg object-cover" />}
          <p className="text-sm">
            Je vraag gaat over <strong>{about.name}</strong>
          </p>
          <input type="hidden" name="about" value={about.path} />
        </div>
      )}
      {state.message && (
        <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger sm:col-span-2">
          {state.message}
        </p>
      )}
      <Field label="Naam" name="name" autoComplete="name" required error={e.name} />
      <Field label="E-mailadres" name="email" type="email" autoComplete="email" required error={e.email} />
      <Field label="Telefoonnummer" hint="(optioneel)" name="phone" type="tel" autoComplete="tel" error={e.phone} />
      <Field key={about?.path ?? "none"} label="Onderwerp" hint="(optioneel)" name="subject" defaultValue={about ? `Vraag over ${about.name}` : ""} error={e.subject} />
      <div className="sm:col-span-2">
        <Field label="Je bericht" name="message" textarea required error={e.message} />
      </div>
      <div className="sm:col-span-2">
        <Privacy error={e.privacy} />
      </div>
      <div className="sm:col-span-2">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Versturen…" : "Verstuur bericht"}
        </button>
      </div>
    </form>
  );
}

export function LookBookForm() {
  const { state, pending, onSubmit, started } = useForm(requestLookBook);
  if (state.ok) return <Done message={state.message} />;
  const e = state.errors ?? {};
  return (
    <form onSubmit={onSubmit} className="grid gap-5 sm:grid-cols-2" noValidate>
      <Hidden started={started} />
      {state.message && (
        <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger sm:col-span-2">
          {state.message}
        </p>
      )}
      <Field label="Naam" name="name" autoComplete="name" required error={e.name} />
      <Field label="E-mailadres" name="email" type="email" autoComplete="email" required error={e.email} />
      <Field label="Trouwdatum" hint="(optioneel)" name="weddingDate" type="date" error={e.weddingDate} />
      <div className="sm:col-span-2">
        <Privacy error={e.privacy} />
      </div>
      <div>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Versturen…" : "Stuur mij het Look Book"}
        </button>
      </div>
    </form>
  );
}

export function StoryForm() {
  const { state, pending, onSubmit, started } = useForm(submitStory);
  if (state.ok) return <Done message={state.message} />;
  const e = state.errors ?? {};
  return (
    <form onSubmit={onSubmit} className="grid gap-5 sm:grid-cols-2" noValidate encType="multipart/form-data">
      <Hidden started={started} />
      {state.message && (
        <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger sm:col-span-2">
          {state.message}
        </p>
      )}
      <Field label="Jullie namen" name="name" placeholder="Bijv. Demy & Quincy" required error={e.name} />
      <Field label="E-mailadres" name="email" type="email" autoComplete="email" required error={e.email} />
      <div className="sm:col-span-2">
        <Field label="Jullie verhaal" name="story" textarea required error={e.story} placeholder="Hoe was je pasafspraak, en hoe was de grote dag?" />
      </div>
      <div className="sm:col-span-2">
        <Field label="Een mooie trouwfoto" hint="(optioneel, max. 10 MB)" name="photo" type="file" accept="image/*" error={e.photo} />
      </div>
      <div className="sm:col-span-2">
        <Privacy error={e.privacy} text={<>Ik geef toestemming om ons verhaal en de foto op de website te plaatsen (zie de <Link href="/privacy/" className="link">privacyverklaring</Link>).</>} />
      </div>
      <div>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Versturen…" : "Deel ons verhaal"}
        </button>
      </div>
    </form>
  );
}

export function FavoritesList() {
  const fav = useFavorites();
  if (!fav.list.length)
    return (
      <div className="rounded-[1.5rem] bg-cream p-10 text-center">
        <Icon name="heart" className="mx-auto h-10 w-10 text-lilac-700" />
        <p className="mt-4 font-serif text-3xl">Nog geen favorieten</p>
        <p className="mt-2 text-ink-soft">Tik op het hartje bij een jurk of pak om hem te bewaren.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/trouwjurken/" className="btn-primary">
            Trouwjurken bekijken
          </Link>
          <Link href="/pakken/" className="btn-ghost">
            Trouwpakken bekijken
          </Link>
        </div>
      </div>
    );
  return (
    <div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
        {fav.list.map((f) => (
          <li key={f.path} className="group relative">
            <Link href={f.path} className="block">
              <div className="relative aspect-[3/4] overflow-hidden rounded-tr-[3.5rem] bg-cream-2">{f.image && <Image src={f.image} alt={f.name} fill sizes="(max-width: 768px) 50vw, 25vw" className="object-cover" />}</div>
              <p className="mt-3 font-serif text-xl">{f.name}</p>
            </Link>
            <button type="button" onClick={() => fav.remove(f.path)} className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-white/90" aria-label={`${f.name} verwijderen`}>
              <Icon name="close" className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-12 flex flex-wrap gap-3">
        <Link href={fav.list.some((f) => f.kind === "suit") && !fav.list.some((f) => f.kind === "dress") ? "/afspraak-maken/trouwpak-passen/" : "/afspraak-maken/trouwjurk-passen/"} className="btn-primary">
          <Icon name="calendar" className="h-4 w-4" /> Plan een pasafspraak met deze favorieten
        </Link>
        <button type="button" onClick={fav.clear} className="btn-ghost">
          Lijst leegmaken
        </button>
      </div>
    </div>
  );
}
