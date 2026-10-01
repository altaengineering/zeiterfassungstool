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

/**
 * Rechnet von der Zahl, die Mitarbeitende tatsächlich kennen (ihr aktueller Gleitzeit-/
 * Überstunden-Saldo, "wie viele Stunden stehe ich gerade im Plus/Minus") zurück auf den Übertrag
 * aus dem alten Jahr, den JahresStammdaten.stundenuebertragAltesJahr erwartet.
 *
 * Analog zum Ferien-Bug (siehe berechneUebertragAusAktuellemSaldo in ferien.ts): auf der
 * Einrichtungsseite wurde der eingegebene aktuelle Saldo bisher direkt als Übertrag gespeichert.
 * Stand(heute) = Übertrag + akkumuliertDiesesJahr (siehe berechneStandReihe) — ohne Rückrechnung
 * zählte die App die diesjährigen Plus/Minus-Stunden dann ein zweites Mal oben drauf, der
 * Excel-Export (der denselben Übertrag als Summen!B14 verwendet) zeigte dieselbe doppelt gezählte
 * Gleitzeit.
 */
export function berechneUebertragAusAktuellemStundenSaldo(
  aktuellerSaldo: number,
  akkumuliertDiesesJahr: number,
): number {
  return aktuellerSaldo - akkumuliertDiesesJahr;
}
