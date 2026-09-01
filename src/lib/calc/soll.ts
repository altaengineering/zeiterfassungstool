import type { Feiertag, ISODate } from "./types";
import { istWochenende } from "./datum";

/** Entspricht Summen!B9: `= Wochenstunden / 5 * Anstellung%`. */
export function sollProTag(wochenstunden: number, anstellungPct: number): number {
  return (wochenstunden / 5) * anstellungPct;
}

function findeFeiertag(date: ISODate, feiertage: Feiertag[]): Feiertag | undefined {
  return feiertage.find((f) => f.date === date);
}

/**
 * Entspricht der Original-Formel in Spalte R (siehe CLAUDE.md §3):
 * Wochenende -> 0. Feiertag mit bezahlt=ja -> 0. Feiertag mit bezahlt=nein -> voller Soll
 * (Entscheidung CLAUDE.md §7 Punkt 1). Sonst -> voller Soll.
 * `override` hat immer Vorrang (CLAUDE.md §7 Punkt 2, DailyEntry.sollOverride).
 */
export function berechneSoll(
  date: ISODate,
  sollProTagWert: number,
  feiertage: Feiertag[],
  override?: number | null,
): number {
  if (override !== undefined && override !== null) {
    return override;
  }
  if (istWochenende(date)) {
    return 0;
  }
  const feiertag = findeFeiertag(date, feiertage);
  if (feiertag && feiertag.bezahlt) {
    return 0;
  }
  return sollProTagWert;
}
