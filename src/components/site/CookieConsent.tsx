"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

// Cookietoestemming voor Google Tag Manager met Consent Mode v2. Standaard staat alles op "denied" (zie Gtm.tsx);
// pas na een keuze sturen we een consent-update naar GTM. De keuze staat 12 maanden in de cookie hms_consent.
type Choice = { analytics: boolean; marketing: boolean };
const COOKIE = "hms_consent";
const OPEN_EVENT = "hms:cookie-settings";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function readChoice(): Choice | null {
  const m = document.cookie.match(new RegExp(`${COOKIE}=([^;]+)`));
  if (!m) return null;
  try {
    return JSON.parse(decodeURIComponent(m[1])) as Choice;
  } catch {
    return null;
  }
}

function apply(choice: Choice) {
  document.cookie = `${COOKIE}=${encodeURIComponent(JSON.stringify(choice))}; Max-Age=${60 * 60 * 24 * 365}; Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  window.gtag?.("consent", "update", {
    analytics_storage: choice.analytics ? "granted" : "denied",
    ad_storage: choice.marketing ? "granted" : "denied",
    ad_user_data: choice.marketing ? "granted" : "denied",
    ad_personalization: choice.marketing ? "granted" : "denied",
  });
  window.dataLayer?.push({ event: "consent_update" });
}

export function CookieConsent() {
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState(false);
  const [choice, setChoice] = useState<Choice>({ analytics: false, marketing: false });

  useEffect(() => {
    const existing = readChoice();
    if (existing) setChoice(existing);
    else setOpen(true);
    const onOpen = () => {
      setDetails(true);
      setOpen(true);
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  if (!open) return null;
  const save = (c: Choice) => {
    apply(c);
    setChoice(c);
    setOpen(false);
  };

  return (
    <div role="dialog" aria-modal="false" aria-labelledby="cookie-title" className="fixed inset-x-3 bottom-3 z-[70] mx-auto max-w-xl rounded-3xl border border-line bg-white p-6 text-ink shadow-2xl sm:bottom-6">
      <h2 id="cookie-title" className="font-serif text-2xl">
        Cookies, net zo zorgvuldig als je jurk
      </h2>
      <p className="mt-2 text-sm text-ink-soft">
        We gebruiken functionele cookies om de site te laten werken. Met jouw toestemming meten we ook anoniem hoe de site gebruikt wordt en tonen we relevantere advertenties. Lees meer in onze{" "}
        <Link href="/cookies/" className="link">
          cookieverklaring
        </Link>
        .
      </p>
      {details && (
        <fieldset className="mt-4 space-y-3 rounded-2xl bg-cream p-4 text-sm">
          <legend className="sr-only">Cookievoorkeuren</legend>
          <label className="flex items-start gap-3">
            <input type="checkbox" checked disabled className="mt-1 h-4 w-4 accent-ink" />
            <span>
              <strong>Functioneel</strong> — altijd aan, nodig voor de website.
            </span>
          </label>
          <label className="flex items-start gap-3">
            <input type="checkbox" checked={choice.analytics} onChange={(e) => setChoice({ ...choice, analytics: e.target.checked })} className="mt-1 h-4 w-4 accent-ink" />
            <span>
              <strong>Statistiek</strong> — anoniem meten welke pagina&apos;s bezocht worden.
            </span>
          </label>
          <label className="flex items-start gap-3">
            <input type="checkbox" checked={choice.marketing} onChange={(e) => setChoice({ ...choice, marketing: e.target.checked })} className="mt-1 h-4 w-4 accent-ink" />
            <span>
              <strong>Marketing</strong> — advertenties meten en personaliseren.
            </span>
          </label>
        </fieldset>
      )}
      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" className="btn-primary !py-3" onClick={() => save({ analytics: true, marketing: true })}>
          Alles accepteren
        </button>
        {details ? (
          <button type="button" className="btn-ghost !py-3" onClick={() => save(choice)}>
            Keuze opslaan
          </button>
        ) : (
          <button type="button" className="btn-ghost !py-3" onClick={() => setDetails(true)}>
            Instellen
          </button>
        )}
        <button type="button" className="btn !px-3 !py-3 text-ink-soft underline" onClick={() => save({ analytics: false, marketing: false })}>
          Alleen noodzakelijk
        </button>
      </div>
    </div>
  );
}

export function CookieSettingsButton() {
  return (
    <button type="button" className="hover:text-white hover:underline" onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}>
      Cookievoorkeuren
    </button>
  );
}
