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

/**
 * Alle Arbeitstage (Mo-Fr, ohne die übergebenen bezahlten Feiertage) im Bereich [von, bis], beide
 * Enden inklusive. Anders als `arbeitstageBisher` in der Chef-Übersicht (nur "ein Monat bis
 * Stichtag") für einen beliebigen Zeitraum gedacht, der auch Monats-/Jahresgrenzen überschreiten
 * kann — gebraucht für Ferienanträge, sowohl um die Anzahl zu zählen als auch um beim Genehmigen
 * die betroffenen Tage einzeln zu kennen (siehe src/lib/ferienAntrag.ts).
 */
export function arbeitstageImZeitraum(
  von: ISODate,
  bis: ISODate,
  feiertage: ReadonlySet<string>,
): ISODate[] {
  const tage: ISODate[] = [];
  let cursor = parseISODate(von);
  const endeMs = parseISODate(bis).getTime();
  while (cursor.getTime() <= endeMs) {
    const dateStr = cursor.toISOString().slice(0, 10);
    if (!istWochenende(dateStr) && !feiertage.has(dateStr)) {
      tage.push(dateStr);
    }
    cursor = new Date(cursor.getTime() + 86400000);
  }
  return tage;
}
