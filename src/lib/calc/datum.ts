import type { ISODate } from "./types";

/** Parst "YYYY-MM-DD" in ein UTC-Datum, um Zeitzonenverschiebungen zu vermeiden. */
export function parseISODate(date: ISODate): Date {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) {
    throw new Error(`Ungültiges ISO-Datum: ${date}`);
  }
  return new Date(Date.UTC(y, m - 1, d));
}

/**
 * Entspricht Excel WEEKDAY(datum,2) in {6,7} — Samstag/Sonntag.
 * JS getUTCDay(): 0=Sonntag..6=Samstag.
 */
export function istWochenende(date: ISODate): boolean {
  const tag = parseISODate(date).getUTCDay();
  return tag === 0 || tag === 6;
}
