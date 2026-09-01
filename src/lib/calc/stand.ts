/** Entspricht Spalte T: `=S4-R4`. */
export function berechnePlusMinus(ist: number, soll: number): number {
  return ist - soll;
}

/** Entspricht Spalte U: `=U_vortag+T4` — ein einzelner Schritt des rollierenden Saldos. */
export function berechneStand(standVortag: number, plusMinus: number): number {
  return standVortag + plusMinus;
}

/**
 * Rollt den Saldo über eine chronologisch sortierte Tagesreihe fort (läuft über Monats- und
 * Jahresgrenzen hinweg, siehe CLAUDE.md §3/§4). `startWert` = Stand des Vortages bzw. am
 * 1. Januar der Wert aus JahresStammdaten.stundenuebertragAltesJahr.
 */
export function berechneStandReihe(
  startWert: number,
  plusMinusReihe: readonly number[],
): number[] {
  const stand: number[] = [];
  let laufenderStand = startWert;
  for (const plusMinus of plusMinusReihe) {
    laufenderStand = berechneStand(laufenderStand, plusMinus);
    stand.push(laufenderStand);
  }
  return stand;
}
