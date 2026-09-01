/**
 * Standard-Jahresferientage-Konstante aus dem Original (Summen!B16), CLAUDE.md §7 Punkt 3:
 * bleibt eine (pro Firma/Jahr administrierbare) globale Konstante, nicht pro Mitarbeitendem.
 * `= 6.5/12*20 - 0.00333333` ≈ 10.83 Tage/Jahr.
 */
export const STANDARD_JAHRESFERIENTAGE = (6.5 / 12) * 20 - 0.00333333;

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
 * Tage über den Soll-pro-Tag-Wert.
 */
export function berechneFerienBezogen(
  ferienStundenProMonat: readonly number[],
  sollProTag: number,
): number {
  const summeStunden = ferienStundenProMonat.reduce((sum, h) => sum + h, 0);
  return summeStunden / sollProTag;
}

/** Entspricht Summen!B20: `=Ferien_Guthaben-Ferien_bezogen`. */
export function berechneFerienuebertragNaechstesJahr(
  ferienGuthaben: number,
  ferienBezogen: number,
): number {
  return ferienGuthaben - ferienBezogen;
}
