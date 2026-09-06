import crypto from "node:crypto";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

/** Erzeugt ein zufälliges, gut lesbares Passwort (ohne verwechselbare Zeichen wie 0/O, l/1). */
export function generiereZufallsPasswort(laenge = 10): string {
  const bytes = crypto.randomBytes(laenge);
  let ergebnis = "";
  for (let i = 0; i < laenge; i++) {
    ergebnis += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return ergebnis;
}
