import "server-only";
import { db } from "./db";
import { getAppointmentSettings, type AppointmentSettings } from "./settings";

// Beschikbaarheid van pasafspraken: tijdsloten per weekdag uit de instellingen, minus gesloten dagen en
// minus volgeboekte slots (capaciteit per slot, geannuleerde afspraken tellen niet mee).

export type DaySlots = Record<string, { time: string; left: number }[]>;

/** Vandaag als YYYY-MM-DD in Nederlandse tijd. */
export function todayNl() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam" }).format(new Date());
}

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function weekday(iso: string) {
  return new Date(`${iso}T12:00:00Z`).getUTCDay();
}

export function window(settings: AppointmentSettings) {
  const today = todayNl();
  return { first: addDays(today, settings.leadDays), last: addDays(today, settings.maxDaysAhead) };
}

export async function availability(typeKey: string, from: string, to: string): Promise<DaySlots> {
  const settings = await getAppointmentSettings();
  const type = settings.types.find((t) => t.key === typeKey);
  if (!type) return {};
  const { first, last } = window(settings);
  const start = from < first ? first : from;
  const end = to > last ? last : to;
  if (start > end) return {};
  const booked = await db.appointment.groupBy({ by: ["date", "time"], where: { type: typeKey, date: { gte: start, lte: end }, status: { not: "geannuleerd" } }, _count: { _all: true } });
  const count = new Map(booked.map((b) => [`${b.date} ${b.time}`, b._count._all]));
  const out: DaySlots = {};
  for (let d = start; d <= end; d = addDays(d, 1)) {
    if (settings.closedDates.includes(d)) continue;
    const times = type.slots[String(weekday(d))] ?? [];
    const slots = times.map((time) => ({ time, left: Math.max(0, settings.capacityPerSlot - (count.get(`${d} ${time}`) ?? 0)) }));
    if (slots.length) out[d] = slots;
  }
  return out;
}

export async function slotIsFree(typeKey: string, date: string, time: string) {
  const days = await availability(typeKey, date, date);
  return (days[date]?.find((s) => s.time === time)?.left ?? 0) > 0;
}
