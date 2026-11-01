"use client";
import Image from "next/image";
import Link from "next/link";
import { startTransition, useActionState, useEffect, useMemo, useRef, useState } from "react";
import { bookAppointment, type FormState } from "@/app/actions/public";
import { Icon } from "@/components/Icon";
import { useFavorites } from "./favorites";

// Afsprakenplanner in 3 stappen: soort afspraak → datum & tijd (live beschikbaarheid) → gegevens.
// Werkt met toetsenbord en schermlezer; elke stap is te corrigeren via het overzicht rechts.

type Type = { key: string; label: string; short: string; description: string; durationMin: number };
type Slot = { time: string; left: number };
type Product = { path: string; name: string; image: string | null };
type Props = { types: Type[]; initialType: string | null; firstDate: string; lastDate: string; source?: string; phone: string; phoneIntl: string };

const MONTHS = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];
const DAYS = ["ma", "di", "wo", "do", "vr", "za", "zo"];
const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const longDate = (s: string) => new Intl.DateTimeFormat("nl-NL", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${s}T12:00:00Z`));

function icsHref(data: Record<string, string>, address: string) {
  const start = `${data.date.replace(/-/g, "")}T${data.time.replace(":", "")}00`;
  const end = new Date(`${data.date}T${data.time}:00`);
  end.setMinutes(end.getMinutes() + Number(data.duration || 60));
  const pad = (n: number) => String(n).padStart(2, "0");
  const endStr = `${end.getFullYear()}${pad(end.getMonth() + 1)}${pad(end.getDate())}T${pad(end.getHours())}${pad(end.getMinutes())}00`;
  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Honeymoon shop//Afspraak//NL", "BEGIN:VEVENT", `UID:${data.id}@honeymoonshop.nl`, `DTSTART;TZID=Europe/Amsterdam:${start}`, `DTEND;TZID=Europe/Amsterdam:${endStr}`, `SUMMARY:${data.type} bij de Honeymoon shop`, `LOCATION:${address}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}

export function AppointmentWizard({ types, initialType, firstDate, lastDate, source, phone, phoneIntl }: Props) {
  const [state, action, pending] = useActionState<FormState, FormData>(bookAppointment, { ok: false });
  const [type, setType] = useState<string | null>(initialType);
  const [step, setStep] = useState(initialType ? 2 : 1);
  const [month, setMonth] = useState(() => {
    // Valt de eerste beschikbare dag aan het eind van de maand, begin dan meteen met de volgende maand.
    const [y, m, d] = firstDate.split("-").map(Number);
    if (d > 24) return m === 12 ? { y: y + 1, m: 0 } : { y, m };
    return { y, m: m - 1 };
  });
  const [days, setDays] = useState<Record<string, Slot[]>>({});
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [companions, setCompanions] = useState(1);
  const [started] = useState(() => Date.now());
  const fav = useFavorites();
  const [chosenFavs, setChosenFavs] = useState<string[] | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [product, setProduct] = useState<Product | null>(null);

  // ?type=perfect-match en ?product=/trouwjurken/... uit de URL (client-side, zodat de pagina statisch blijft)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const t = q.get("type");
    if (t && types.some((x) => x.key === t)) {
      setType(t);
      setStep(2);
    }
    const p = q.get("product");
    if (p) fetch(`/api/product-card/?path=${encodeURIComponent(p)}`).then((r) => (r.ok ? r.json() : null)).then((d: Product | null) => d && setProduct(d));
  }, [types]);
  const current = types.find((t) => t.key === type) ?? null;
  const favs = useMemo(() => fav.list.filter((f) => f.kind !== "accessory" || true), [fav.list]);
  const selectedFavs = chosenFavs ?? favs.map((f) => f.path);

  useEffect(() => {
    heading.current?.focus();
  }, [step, state.ok]);

  // Slot net vergeven? Terug naar de kalender met verse beschikbaarheid.
  useEffect(() => {
    if (state.errors?.time || state.errors?.date) {
      setTime(null);
      setStep(2);
    }
  }, [state]);

  useEffect(() => {
    if (!type) return;
    const from = iso(month.y, month.m, 1);
    const to = iso(month.y, month.m, new Date(Date.UTC(month.y, month.m + 1, 0)).getUTCDate());
    let cancelled = false;
    setLoading(true);
    fetch(`/api/appointments/slots/?type=${type}&from=${from}&to=${to}`)
      .then((r) => r.json())
      .then((d: { days?: Record<string, Slot[]> }) => {
        if (!cancelled) setDays(d.days ?? {});
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [type, month, state.errors?.time]);

  const err = (k: string) => state.errors?.[k];
  const firstMonth = firstDate.slice(0, 7);
  const lastMonth = lastDate.slice(0, 7);
  const curMonth = iso(month.y, month.m, 1).slice(0, 7);
  const shift = (n: number) => setMonth(({ y, m }) => ({ y: m + n < 0 ? y - 1 : m + n > 11 ? y + 1 : y, m: (m + n + 12) % 12 }));
  const firstWeekday = (new Date(Date.UTC(month.y, month.m, 1)).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(month.y, month.m + 1, 0)).getUTCDate();

  if (state.ok && state.data) {
    const d = state.data;
    return (
      <div className="rounded-[2rem] bg-white p-8 text-center shadow-[0_30px_80px_-40px_rgba(43,40,67,0.45)] sm:p-12">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-lilac text-ink">
          <Icon name="check" className="h-8 w-8" />
        </span>
        <h2 ref={heading} tabIndex={-1} className="mt-6 text-5xl outline-none">
          Tot snel, {d.name.split(" ")[0]}!
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-lg text-ink-soft">
          Je aanvraag voor <strong className="text-ink">{d.type.toLowerCase()}</strong> op <strong className="text-ink">{longDate(d.date)}</strong> om <strong className="text-ink">{d.time} uur</strong> is ontvangen. We bevestigen je afspraak per e-mail aan {d.email}.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a href={icsHref(d, "Korte Hoogstraat 4, 3011 GL Rotterdam")} download="afspraak-honeymoon-shop.ics" className="btn-primary">
            <Icon name="calendar" className="h-4 w-4" /> Zet in mijn agenda
          </a>
          <Link href="/bereikbaarheid-en-parkeergelegenheden/" className="btn-ghost">
            <Icon name="pin" className="h-4 w-4" /> Route en parkeren
          </Link>
        </div>
        <div className="mx-auto mt-10 grid max-w-2xl gap-4 text-left sm:grid-cols-3">
          {[
            ["Neem je favorieten mee", "Bewaar jurken met het hartje, dan liggen ze klaar."],
            ["Wie neem je mee?", "Je mag maximaal drie dierbaren meenemen."],
            ["Goed voorbereid", <Link key="l" href="/de-winkel/eerste-pasafspraak/" className="link">Lees hoe je eerste pasafspraak verloopt</Link>],
          ].map(([t, x], i) => (
            <div key={i} className="rounded-2xl bg-cream p-4 text-sm">
              <p className="font-medium">{t}</p>
              <p className="mt-1 text-ink-soft">{x}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <form
      className="grid gap-8 lg:grid-cols-[1fr_320px]"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
    >
      <input type="hidden" name="type" value={type ?? ""} />
      <input type="hidden" name="date" value={date ?? ""} />
      <input type="hidden" name="time" value={time ?? ""} />
      <input type="hidden" name="started" value={started} />
      <input type="hidden" name="source" value={source ?? ""} />
      {product && <input type="hidden" name="product" value={product.path} />}
      {selectedFavs.map((f) => (
        <input key={f} type="hidden" name="favorites" value={f} />
      ))}
      <div className="hidden" aria-hidden="true">
        <label>
          Website <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="rounded-[2rem] bg-white p-6 shadow-[0_30px_80px_-40px_rgba(43,40,67,0.45)] sm:p-10">
        <ol className="mb-8 grid grid-cols-3 gap-2" aria-label="Voortgang">
          {["Soort afspraak", "Datum & tijd", "Jouw gegevens"].map((l, i) => (
            <li key={l} aria-current={step === i + 1 ? "step" : undefined}>
              <span className={`block h-1.5 rounded-full transition ${step > i ? "bg-lilac-700" : "bg-cream-2"}`} />
              <span className={`mt-2 block text-xs ${step === i + 1 ? "font-semibold text-ink" : "text-ink-soft"}`}>
                {i + 1}. {l}
              </span>
            </li>
          ))}
        </ol>

        {state.message && !state.ok && (
          <p role="alert" className="mb-6 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
            {state.message}
          </p>
        )}

        {step === 1 && (
          <fieldset>
            <legend>
              <h2 ref={heading} tabIndex={-1} className="text-4xl outline-none">
                Wat wil je komen passen?
              </h2>
            </legend>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {types.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => {
                    setType(t.key);
                    setDate(null);
                    setTime(null);
                    setStep(2);
                  }}
                  aria-pressed={type === t.key}
                  className={`group rounded-2xl border-2 p-5 text-left transition ${type === t.key ? "border-ink bg-cream" : "border-line hover:border-ink/50"}`}
                >
                  <span className="eyebrow text-lilac-700">{t.short}</span>
                  <span className="mt-1 block font-serif text-2xl">{t.label}</span>
                  <span className="mt-1 block text-sm text-ink-soft">{t.description}</span>
                  <span className="mt-3 inline-flex items-center gap-1.5 text-xs text-ink-soft">
                    <Icon name="clock" className="h-4 w-4" /> ca. {t.durationMin >= 90 ? `${t.durationMin / 60} uur` : `${t.durationMin} minuten`}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {step === 2 && current && (
          <div>
            <h2 ref={heading} tabIndex={-1} className="text-4xl outline-none">
              Wanneer wil je komen?
            </h2>
            <p className="mt-2 text-ink-soft">
              Beschikbare dagen voor <strong className="text-ink">{current.label.toLowerCase()}</strong> zijn gemarkeerd.
            </p>
            <div className="mt-6 grid gap-8 md:grid-cols-[1.2fr_1fr]">
              <div>
                <div className="flex items-center justify-between">
                  <button type="button" onClick={() => shift(-1)} disabled={curMonth <= firstMonth} className="grid h-10 w-10 place-items-center rounded-full hover:bg-cream disabled:opacity-30" aria-label="Vorige maand">
                    <Icon name="chevronLeft" />
                  </button>
                  <p className="font-serif text-2xl capitalize" aria-live="polite">
                    {MONTHS[month.m]} {month.y}
                  </p>
                  <button type="button" onClick={() => shift(1)} disabled={curMonth >= lastMonth} className="grid h-10 w-10 place-items-center rounded-full hover:bg-cream disabled:opacity-30" aria-label="Volgende maand">
                    <Icon name="chevronRight" />
                  </button>
                </div>
                <div className={`mt-4 grid grid-cols-7 gap-1 text-center transition ${loading ? "opacity-50" : ""}`} role="grid" aria-label="Kies een datum">
                  {DAYS.map((d) => (
                    <span key={d} className="py-1 text-xs uppercase text-ink-soft" role="columnheader">
                      {d}
                    </span>
                  ))}
                  {Array.from({ length: firstWeekday }, (_, i) => (
                    <span key={`e${i}`} />
                  ))}
                  {Array.from({ length: daysInMonth }, (_, i) => {
                    const d = iso(month.y, month.m, i + 1);
                    const slots = days[d];
                    const free = slots?.some((s) => s.left > 0);
                    return (
                      <button
                        key={d}
                        type="button"
                        disabled={!free}
                        onClick={() => {
                          setDate(d);
                          setTime(null);
                        }}
                        aria-pressed={date === d}
                        aria-label={`${longDate(d)}${free ? "" : " — niet beschikbaar"}`}
                        className={`aspect-square rounded-full text-sm transition ${date === d ? "bg-ink text-white" : free ? "bg-lilac-100 font-medium hover:bg-lilac" : "text-ink-soft/40"}`}
                      >
                        {i + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <p className="label">{date ? longDate(date) : "Kies eerst een datum"}</p>
                {date && (
                  <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Kies een tijd">
                    {(days[date] ?? []).map((s) => (
                      <button key={s.time} type="button" role="radio" aria-checked={time === s.time} disabled={s.left === 0} onClick={() => setTime(s.time)} className={`rounded-xl border-2 px-3 py-3 text-left transition disabled:opacity-40 ${time === s.time ? "border-ink bg-ink text-white" : "border-line hover:border-ink/50"}`}>
                        <span className="block font-medium">{s.time}</span>
                        <span className={`text-xs ${time === s.time ? "text-white/80" : "text-ink-soft"}`}>{s.left === 0 ? "Vol" : s.left === 1 ? "Nog 1 plek" : "Beschikbaar"}</span>
                      </button>
                    ))}
                  </div>
                )}
                {err("time") && <p className="mt-2 text-sm text-danger">{err("time")}</p>}
                <p className="mt-6 text-sm text-ink-soft">
                  Geen geschikt moment? Bel ons op{" "}
                  <a href={`tel:${phoneIntl}`} className="link">
                    {phone}
                  </a>
                  , dan zoeken we samen een tijd.
                </p>
              </div>
            </div>
            <div className="mt-8 flex flex-wrap justify-between gap-3">
              <button type="button" className="btn-ghost" onClick={() => setStep(1)}>
                <Icon name="arrowLeft" className="h-4 w-4" /> Andere afspraak
              </button>
              <button type="button" className="btn-primary" disabled={!date || !time} onClick={() => setStep(3)}>
                Naar je gegevens <Icon name="arrow" className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* stap 3 blijft gemonteerd zodat ingevulde velden bewaard blijven bij terug/vooruit */}
        {type && (
          <div hidden={step !== 3}>
            <h2 ref={step === 3 ? heading : undefined} tabIndex={-1} className="text-4xl outline-none">
              Bijna klaar!
            </h2>
            <p className="mt-2 text-ink-soft">Vertel ons wie je bent, dan bereidt jouw styliste de afspraak voor.</p>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <Field label="Naam" name="name" autoComplete="name" required error={err("name")} />
              <Field label="E-mailadres" name="email" type="email" autoComplete="email" required error={err("email")} />
              <Field label="Telefoonnummer" name="phone" type="tel" autoComplete="tel" required error={err("phone")} />
              <Field label="Trouwdatum" hint="(optioneel)" name="weddingDate" type="date" error={err("weddingDate")} />
              <div>
                <span className="label" id="companions-label">
                  Hoeveel mensen neem je mee?
                </span>
                <div className="flex items-center gap-3" role="group" aria-labelledby="companions-label">
                  <button type="button" className="grid h-11 w-11 place-items-center rounded-full border border-line text-xl hover:border-ink" onClick={() => setCompanions(Math.max(0, companions - 1))} aria-label="Minder">
                    −
                  </button>
                  <output className="w-8 text-center font-serif text-3xl" aria-live="polite">
                    {companions}
                  </output>
                  <button type="button" className="grid h-11 w-11 place-items-center rounded-full border border-line text-xl hover:border-ink" onClick={() => setCompanions(Math.min(3, companions + 1))} aria-label="Meer">
                    +
                  </button>
                  <input type="hidden" name="companions" value={companions} />
                </div>
                <p className="mt-1 text-xs text-ink-soft">Maximaal 3, zodat er alle aandacht voor jou is.</p>
              </div>
              <label className="block">
                <span className="label">
                  Budget <span className="font-normal text-ink-soft">(optioneel)</span>
                </span>
                <select name="budget" className="field" defaultValue="">
                  <option value="">Weet ik nog niet</option>
                  <option>Tot €1.500</option>
                  <option>€1.500 – €2.000</option>
                  <option>€2.000 – €2.500</option>
                  <option>€2.500 – €3.000</option>
                  <option>Meer dan €3.000</option>
                </select>
              </label>
              <label className="block sm:col-span-2">
                <span className="label">
                  Wensen of vragen <span className="font-normal text-ink-soft">(optioneel)</span>
                </span>
                <textarea name="notes" rows={3} className="field" placeholder="Bijvoorbeeld: ik zoek een jurk met lange mouwen, of we komen samen passen." />
              </label>
            </div>

            {(product || favs.length > 0) && (
              <fieldset className="mt-6 rounded-2xl bg-cream p-5">
                <legend className="sr-only">Favorieten meesturen</legend>
                <p className="flex items-center gap-2 font-medium">
                  <Icon name="heart" className="h-5 w-5 text-lilac-700" /> Dit zetten we voor je klaar
                </p>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {product && (
                    <li className="flex items-center gap-3 rounded-xl bg-white p-2">
                      {product.image && <Image src={product.image} alt="" width={40} height={52} className="h-13 w-10 rounded-md object-cover" />}
                      <span className="text-sm">{product.name}</span>
                    </li>
                  )}
                  {favs
                    .filter((f) => f.path !== product?.path)
                    .map((f) => (
                      <li key={f.path}>
                        <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-white p-2">
                          <input type="checkbox" className="h-4 w-4 accent-[var(--color-ink)]" checked={selectedFavs.includes(f.path)} onChange={(e) => setChosenFavs(e.target.checked ? [...selectedFavs, f.path] : selectedFavs.filter((x) => x !== f.path))} />
                          {f.image && <Image src={f.image} alt="" width={40} height={52} className="h-13 w-10 rounded-md object-cover" />}
                          <span className="text-sm">{f.name}</span>
                        </label>
                      </li>
                    ))}
                </ul>
              </fieldset>
            )}

            <label className="mt-6 flex items-start gap-3 text-sm">
              <input type="checkbox" name="privacy" required className="mt-1 h-4 w-4 accent-[var(--color-ink)]" aria-invalid={!!err("privacy")} aria-describedby={err("privacy") ? "privacy-error" : undefined} />
              <span>
                Ik ga akkoord met de{" "}
                <Link href="/privacy/" className="link">
                  privacyverklaring
                </Link>{" "}
                en de{" "}
                <Link href="/de-winkel/verkoop-voorwaarden/" className="link">
                  verkoopvoorwaarden
                </Link>
                .
              </span>
            </label>
            {err("privacy") && (
              <p id="privacy-error" className="mt-1 text-sm text-danger">
                {err("privacy")}
              </p>
            )}

            <div className="mt-8 flex flex-wrap justify-between gap-3">
              <button type="button" className="btn-ghost" onClick={() => setStep(2)}>
                <Icon name="arrowLeft" className="h-4 w-4" /> Datum wijzigen
              </button>
              <button type="submit" className="btn-primary" disabled={pending}>
                {pending ? "Bezig met versturen…" : "Afspraak aanvragen"} {!pending && <Icon name="check" className="h-4 w-4" />}
              </button>
            </div>
          </div>
        )}
      </div>

      <aside className="lg:sticky lg:top-28 lg:self-start" aria-label="Jouw afspraak">
        <div className="rounded-[2rem] rounded-tr-[5rem] bg-ink p-7 text-white">
          <p className="eyebrow text-lilac">Jouw afspraak</p>
          <dl className="mt-5 space-y-4">
            {[
              ["Soort", current?.label, 1],
              ["Datum", date ? longDate(date) : null, 2],
              ["Tijd", time ? `${time} uur` : null, 2],
            ].map(([l, v, s]) => (
              <div key={l as string} className="flex items-start justify-between gap-3 border-b border-white/15 pb-3">
                <div>
                  <dt className="text-xs uppercase tracking-[0.16em] text-white/60">{l}</dt>
                  <dd className="mt-0.5 font-serif text-xl">{(v as string) ?? "—"}</dd>
                </div>
                {v && step > (s as number) && (
                  <button type="button" onClick={() => setStep(s as number)} className="text-xs underline underline-offset-4">
                    Wijzig
                  </button>
                )}
              </div>
            ))}
          </dl>
          <ul className="mt-6 space-y-2 text-sm text-white/80">
            <li className="flex gap-2">
              <Icon name="check" className="h-4 w-4 shrink-0 text-lilac" /> Een eigen styliste
            </li>
            <li className="flex gap-2">
              <Icon name="check" className="h-4 w-4 shrink-0 text-lilac" /> Bubbels als je ‘ja’ zegt
            </li>
            <li className="flex gap-2">
              <Icon name="check" className="h-4 w-4 shrink-0 text-lilac" /> Gratis en vrijblijvend
            </li>
          </ul>
        </div>
      </aside>
    </form>
  );
}

function Field({ label, hint, name, type = "text", required, autoComplete, error }: { label: string; hint?: string; name: string; type?: string; required?: boolean; autoComplete?: string; error?: string }) {
  return (
    <label className="block">
      <span className="label">
        {label} {hint && <span className="font-normal text-ink-soft">{hint}</span>}
      </span>
      <input name={name} type={type} required={required} autoComplete={autoComplete} className="field" aria-invalid={!!error} aria-describedby={error ? `${name}-error` : undefined} />
      {error && (
        <span id={`${name}-error`} className="mt-1 block text-sm text-danger">
          {error}
        </span>
      )}
    </label>
  );
}
