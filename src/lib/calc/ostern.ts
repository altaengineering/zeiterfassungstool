import type { ISODate } from "./types";
import { parseISODate } from "./datum";

function zweistellig(n: number): string {
  return String(n).padStart(2, "0");
}

/** Ostersonntag nach dem gregorianischen Kalender (Verfahren nach Meeus, Jones und Butcher). */
export function ostersonntag(jahr: number): ISODate {
  const a = jahr % 19;
  const b = Math.floor(jahr / 100);
  const c = jahr % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const monat = Math.floor((h + l - 7 * m + 114) / 31);
  const tag = ((h + l - 7 * m + 114) % 31) + 1;
  return `${jahr}-${zweistellig(monat)}-${zweistellig(tag)}`;
}

/** Verschiebt ein Datum um eine Anzahl Tage (UTC, ohne Zeitzonenfalle). */
export function addTage(date: ISODate, tage: number): ISODate {
  const d = parseISODate(date);
  d.setUTCDate(d.getUTCDate() + tage);
  return d.toISOString().slice(0, 10);
}

// Feiertage, die von Ostern abhängen: Abstand in Tagen zum Ostersonntag.
const BEWEGLICH: Array<{ muster: RegExp; abstand: number }> = [
  { muster: /karfreitag/i, abstand: -2 },
  { muster: /ostermontag/i, abstand: 1 },
  { muster: /auffahrt/i, abstand: 39 },
  { muster: /pfingstmontag/i, abstand: 50 },
  { muster: /fronleichnam/i, abstand: 60 },
];

/**
 * Datum eines Feiertags im Zielzeitraum, abgeleitet aus dem Eintrag eines früheren Jahres: bewegliche
 * Feiertage (Karfreitag, Ostermontag, Auffahrt, Pfingstmontag, Fronleichnam) werden aus Ostern berechnet,
 * alle anderen behalten Monat und Tag.
 */
export function feiertagFuerJahr(label: string, altesDatum: ISODate, jahr: number): ISODate {
  const beweglich = BEWEGLICH.find((b) => b.muster.test(label));
  if (beweglich) return addTage(ostersonntag(jahr), beweglich.abstand);
  const monat = altesDatum.slice(5, 7);
  const tag = altesDatum.slice(8, 10);
  // 29. Februar gibt es nicht in jedem Jahr
  const kandidat = `${jahr}-${monat}-${tag}`;
  return monat === "02" && tag === "29" ? `${jahr}-02-28` : kandidat;
}
