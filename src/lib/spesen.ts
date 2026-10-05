// Kilometer-Spesensatz in CHF pro km. Gilt, solange fuer die Firma/das Jahr keine eigenen
// CompanySettings hinterlegt sind (in Produktion bisher nie angelegt: der Satz war dadurch 0 und
// die gefahrenen Kilometer wurden im Excel-Export nicht in Franken umgerechnet).
export const STANDARD_KM_SPESENSATZ = 0.7;

/** Spesen-Summe eines Tages: weitere Spesen in Franken plus Kilometer mal Satz. */
export function berechneSpesenSumme(spesenFr: number, km: number, satz: number): number {
  return Math.round((spesenFr + km * satz) * 100) / 100;
}
