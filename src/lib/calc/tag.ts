import type { DailyEntryInput, Feiertag, ISODate, TagesErgebnis } from "./types";
import { berechneSoll } from "./soll";
import { berechneAufteilungIstzeit, berechneIst, berechneIstZeitAusStempelzeiten } from "./ist";
import { berechnePlusMinus, berechneStand } from "./stand";

/**
 * Entweder ein für alle Tage konstanter Soll-pro-Tag-Wert, oder eine Funktion, die ihn pro Datum
 * liefert (App-eigenes Feature: Pensumwechsel mitten im Jahr, siehe `pensum.ts`).
 */
export type SollProTagQuelle = number | ((date: ISODate) => number);

function loeseSollProTagAuf(quelle: SollProTagQuelle, date: ISODate): number {
  return typeof quelle === "function" ? quelle(date) : quelle;
}

/**
 * Berechnet alle Kennzahlen für einen einzelnen Tag (CLAUDE.md §3). `standVortag` ist der
 * rollierende Saldo des Vortages (bzw. am 1. Januar: JahresStammdaten.stundenuebertragAltesJahr).
 */
export function berechneTag(
  entry: DailyEntryInput,
  sollProTagWert: SollProTagQuelle,
  feiertage: Feiertag[],
  standVortag: number,
): TagesErgebnis {
  const sollProTagFuerTag = loeseSollProTagAuf(sollProTagWert, entry.date);
  const soll = berechneSoll(entry.date, sollProTagFuerTag, feiertage, entry.sollOverride);
  const ist = berechneIst(entry);
  const plusMinus = berechnePlusMinus(ist, soll);
  const stand = berechneStand(standVortag, plusMinus);
  const { dezimalstunden } = berechneIstZeitAusStempelzeiten(entry.stempelzeiten);
  const aufteilungIstzeit = berechneAufteilungIstzeit(ist, dezimalstunden);

  return {
    date: entry.date,
    soll,
    ist,
    plusMinus,
    stand,
    istZeitAusStempelzeiten: dezimalstunden,
    aufteilungIstzeit,
  };
}

/** Berechnet eine chronologisch sortierte Reihe von Tagen inkl. rollierendem Stand. */
export function berechneTagesReihe(
  entries: readonly DailyEntryInput[],
  sollProTagWert: SollProTagQuelle,
  feiertage: Feiertag[],
  startStand: number,
): TagesErgebnis[] {
  const ergebnisse: TagesErgebnis[] = [];
  let standVortag = startStand;
  for (const entry of entries) {
    const ergebnis = berechneTag(entry, sollProTagWert, feiertage, standVortag);
    ergebnisse.push(ergebnis);
    standVortag = ergebnis.stand;
  }
  return ergebnisse;
}
