"use client";
import { useSyncExternalStore } from "react";

// Favorieten worden alleen in de browser bewaard (localStorage). Bij een afspraakverzoek kan de bezoeker ze meesturen.
export type Favorite = { path: string; name: string; image: string | null; kind: string };

const KEY = "hms_favorites";
const EVENT = "hms:favorites";
const EMPTY: Favorite[] = [];
let cacheRaw: string | null = null;
let cacheVal: Favorite[] = EMPTY;

function read(): Favorite[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw === cacheRaw) return cacheVal;
    cacheRaw = raw;
    cacheVal = raw ? (JSON.parse(raw) as Favorite[]) : EMPTY;
    return cacheVal;
  } catch {
    return EMPTY;
  }
}

function write(list: Favorite[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function useFavorites() {
  const list = useSyncExternalStore(subscribe, read, () => EMPTY);
  return {
    list,
    has: (path: string) => list.some((f) => f.path === path),
    toggle: (f: Favorite) => write(list.some((x) => x.path === f.path) ? list.filter((x) => x.path !== f.path) : [f, ...list].slice(0, 50)),
    remove: (path: string) => write(list.filter((x) => x.path !== path)),
    clear: () => write([]),
  };
}
