import type { ISODate, JahresStammdatenInput } from "./types";
import { sollProTag } from "./soll";

/**
 * App-eigenes Feature (nicht aus dem Original-Excel, das pro Jahr nur einen konstanten
 * Anstellungsgrad kennt, Summen!B5/B6): erlaubt einen Pensumwechsel MITTEN im Jahr. Ab
 * `gueltigAb` gilt dieser Wert für den Tages-Soll, bis zum nächsten Wechsel.
 */
export interface PensumPeriode extends JahresStammdatenInput {
  gueltigAb: ISODate;
}

/** Ermittelt das für `date` gültige Pensum: der letzte Wechsel mit `gueltigAb <= date`, sonst die Basis. */
export function pensumFuerDatum(
  date: ISODate,
  basis: JahresStammdatenInput,
  wechsel: readonly PensumPeriode[],
): JahresStammdatenInput {
  const sortiert = [...wechsel].sort((a, b) => a.gueltigAb.localeCompare(b.gueltigAb));
  let aktuell: JahresStammdatenInput = basis;
  for (const w of sortiert) {
    if (w.gueltigAb <= date) {
      aktuell = w;
    }
  }
  return aktuell;
}

/** Wie `pensumFuerDatum`, direkt als Soll-pro-Tag-Stundenwert (CLAUDE.md §2, Summen!B9). */
export function sollProTagFuerDatum(
  date: ISODate,
  basis: JahresStammdatenInput,
  wechsel: readonly PensumPeriode[],
): number {
  const pensum = pensumFuerDatum(date, basis, wechsel);
  return sollProTag(pensum.wochenstunden, pensum.anstellungPct);
}
