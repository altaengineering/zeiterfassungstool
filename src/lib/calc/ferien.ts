/**
 * Standard-Jahresferientage, firmenweiter Fallback (pro Person via Einrichtung/Admin-Panel
 * ueberschreibbar, siehe JahresStammdaten.jahresferientage). War urspruenglich 1:1 aus dem
 * Original-Excel uebernommen (Summen!B16, `6.5/12*20-0.00333333` ≈ 10.83 Tage/Jahr), von Michael
 * am 2026-09-23 aber ausdruecklich als falsch korrigiert: der eigentliche Standard ist 4 Wochen
 * Ferien pro Jahr, also 20 Tage. Der alte Excel-Wert war vermutlich selbst schon ein Fehler in der
 * Vorlage (oder etwas anderes gemeint als "Jahresferientage"), nicht etwas, das diese App treu
 * nachbilden sollte.
 */
export const STANDARD_JAHRESFERIENTAGE = 20;

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Entspricht Summen!B18: `=ROUND(Ferienübertrag_altesJahr + Arbeitsmonate/12*Jahresferientage,1)`. */
export function berechneFerienGuthaben(
  ferienuebertragAltesJahr: number,
  arbeitsmonate: number,
  jahresferientage: number,
): number {
  return round1(ferienuebertragAltesJahr + (arbeitsmonate / 12) * jahresferientage);
}

/**
 * Entspricht der Ferien-bezogen-Kette (Summen!B19, siehe CLAUDE.md §2 "Ferien-bezogen-Kette"):
 * Summe der Ferien-Stunden über alle Monate bis inkl. dem betrachteten Zeitraum, umgerechnet in
 * Tage über den Soll-pro-Tag-Wert. `sollProTag` kann pro Monat unterschiedlich sein (App-eigenes
 * Feature: Pensumwechsel mitten im Jahr, siehe `pensum.ts`) — dann ein Array parallel zu
 * `ferienStundenProMonat` übergeben, sonst reicht ein einzelner Wert fürs ganze Jahr.
 */
export function berechneFerienBezogen(
  ferienStundenProMonat: readonly number[],
  sollProTag: number | readonly number[],
): number {
  if (typeof sollProTag === "number") {
    const summeStunden = ferienStundenProMonat.reduce((sum, h) => sum + h, 0);
    return summeStunden / sollProTag;
  }
  return ferienStundenProMonat.reduce((sum, h, i) => sum + h / sollProTag[i]!, 0);
}

/**
 * Nicht aus dem Original-Excel, App-eigenes Feature: `berechneFerienBezogen` zaehlt nur echte
 * Tageseintraege. Wurde ein Ferientag nie als solcher erfasst (Person hat frei genommen, aber
 * beim Eintragen das Ferien-Feld vergessen), fehlt er dort. `korrektur` ist eine manuell
 * eingetragene Zusatzmenge in Tagen (siehe JahresStammdaten.ferienBezogenKorrektur), die addiert
 * statt die Berechnung zu ersetzen, damit zukuenftige echte Eintraege weiterhin korrekt dazukommen.
 */
export function berechneFerienBezogenGesamt(ausEintraegen: number, korrektur: number): number {
  return ausEintraegen + korrektur;
}

/** Entspricht Summen!B20: `=Ferien_Guthaben-Ferien_bezogen`. */
export function berechneFerienuebertragNaechstesJahr(
  ferienGuthaben: number,
  ferienBezogen: number,
): number {
  return ferienGuthaben - ferienBezogen;
}

/**
 * Rückwärts-Rechnung für die Einrichtungsformulare (App-eigenes Feature): Leute kennen
 * typischerweise ihren AKTUELLEN Gesamtsaldo ("wie viele Ferientage habe ich JETZT noch"), nicht
 * den fachlich benötigten `JahresStammdaten.ferienuebertragAltesJahr` (Übertrag aus dem Vorjahr),
 * der laut `berechneFerienGuthaben` erst zusammen mit dem anteiligen Jahresanspruch den
 * Gesamtsaldo ergibt. Wurde der aktuelle Saldo versehentlich direkt als Übertrag gespeichert,
 * zählt der anteilige Jahresanspruch zusätzlich obendrauf (Vorfall 2026-09-23: Michael Küng trug
 * 8.8 ein, Anzeige sprang auf 17.8, weil bereits bezogene 11 Tage plus ein voller Jahresanspruch
 * dazugerechnet wurden). Diese Funktion dreht das um: Übertrag = aktuellerSaldo + bereitsBezogen -
 * anteiliger Jahresanspruch — beide Einrichtungsformulare (src/app/konto/einrichtung,
 * src/app/konto/ferien-einrichtung) fragen seither nach dem aktuellen Saldo und rechnen das hier
 * zurück, bevor sie speichern.
 */
export function berechneUebertragAusAktuellemSaldo(
  aktuellerSaldo: number,
  bereitsBezogen: number,
  arbeitsmonate: number,
  jahresferientage: number,
): number {
  return aktuellerSaldo + bereitsBezogen - (arbeitsmonate / 12) * jahresferientage;
}
