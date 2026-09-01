import type { DailyEntryInput, StempelPaar } from "./types";

/** Entspricht Spalte S: `=SUM(C4:Q4)` — Summe aller Projekt- und Kategorie-Stunden. */
export function berechneIst(entry: Pick<DailyEntryInput,
  "projektStunden" | "krank" | "reisezeit" | "cad" | "ausbildung" | "buero" | "ferien"
>): number {
  return (
    entry.projektStunden +
    entry.krank +
    entry.reisezeit +
    entry.cad +
    entry.ausbildung +
    entry.buero +
    entry.ferien
  );
}

const MINUTEN_PRO_TAG = 24 * 60;

export interface IstZeitAusStempelzeiten {
  /** AG: Summe der 4 Start/Stop-Differenzen in Minuten, modulo 24h (Excel-Zeitwrap). */
  totalMinuten: number;
  /** AH: HOUR(AG) */
  stunden: number;
  /** AI: MINUTE(AG)/60 */
  minutenAlsDezimal: number;
  /** AJ: AH+AI — die für die Aufteilung-Kontrolle relevante Dezimalstunden-Zahl. */
  dezimalstunden: number;
}

/**
 * Entspricht AG4 `=(Z4-Y4)+(AB4-AA4)+(AD4-AC4)+(AF4-AE4)` und AH/AI/AJ (CLAUDE.md §3).
 * Fehlende Start- oder Stop-Werte werden wie leere Excel-Zellen als 0 behandelt.
 * Excel-Zeitwerte wrappen bei 24h (HOUR/MINUTE extrahieren nur die Tageszeit-Komponente),
 * das wird hier über `% MINUTEN_PRO_TAG` nachgebildet.
 */
export function berechneIstZeitAusStempelzeiten(
  paare: readonly [StempelPaar, StempelPaar, StempelPaar, StempelPaar],
): IstZeitAusStempelzeiten {
  const rohSumme = paare.reduce((summe, paar) => {
    const start = paar.start ?? 0;
    const stop = paar.stop ?? 0;
    return summe + (stop - start);
  }, 0);

  const totalMinuten = ((rohSumme % MINUTEN_PRO_TAG) + MINUTEN_PRO_TAG) % MINUTEN_PRO_TAG;
  const stunden = Math.floor(totalMinuten / 60);
  const minutenAlsDezimal = (totalMinuten % 60) / 60;
  const dezimalstunden = stunden + minutenAlsDezimal;

  return { totalMinuten, stunden, minutenAlsDezimal, dezimalstunden };
}

/** Entspricht Spalte AL: `=SUM(C4:Q4)-AJ4` — Kontrollspalte, im Idealfall 0. */
export function berechneAufteilungIstzeit(ist: number, dezimalstundenAusStempelzeiten: number): number {
  return ist - dezimalstundenAusStempelzeiten;
}
