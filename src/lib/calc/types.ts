// Gemeinsame Typen für die Kern-Berechnung. Siehe CLAUDE.md §2/§3 für die fachliche Referenz.

/** ISO-Datum ohne Zeitanteil, z.B. "2026-01-01". */
export type ISODate = string;

export interface Feiertag {
  date: ISODate;
  label: string;
  /** true = "ja" (bezahlt), false = "nein" (unbezahlt) — siehe CLAUDE.md §3. */
  bezahlt: boolean;
}

/** Ein Start/Stop-Paar in Minuten seit Mitternacht (0-1439). Beide null = nicht erfasst. */
export interface StempelPaar {
  start: number | null | undefined;
  stop: number | null | undefined;
}

export interface JahresStammdatenInput {
  wochenstunden: number;
  anstellungPct: number;
}

export interface DailyEntryInput {
  date: ISODate;
  /** Summe aller Projekt-/Kategorie-Buchungen (Spalten C-K). */
  projektStunden: number;
  krank: number;
  reisezeit: number;
  cad: number;
  ausbildung: number;
  buero: number;
  ferien: number;
  /** Manuelles Überschreiben des Tages-Soll, siehe CLAUDE.md §3/§7 Punkt 2. Null = automatisch. */
  sollOverride?: number | null;
  stempelzeiten: [StempelPaar, StempelPaar, StempelPaar, StempelPaar];
}

export interface TagesErgebnis {
  date: ISODate;
  soll: number;
  ist: number;
  plusMinus: number;
  stand: number;
  istZeitAusStempelzeiten: number;
  aufteilungIstzeit: number;
}
