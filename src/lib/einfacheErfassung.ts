// Einfache Erfassung: eine Person traegt pro Tag nur noch die Ist-Zeit ein, ohne Stempelzeiten
// (Kommen/Gehen), ohne Projektauswahl und ohne den Abgleich "Summe Projekte = Stempelzeiten".
// Die Person kann sie nur beantragen, eingeschaltet wird sie von einem Admin (Chef). Ausschalten
// darf die Person selbst jederzeit, das fuehrt zurueck zur normalen Erfassung mit allen Regeln.
//
// Gespeichert wird die Ist-Zeit als eine Buchung ohne Projekt mit dem Namen EINFACH_LABEL. Damit
// zaehlt sie ueberall mit, wo Buchungen zaehlen (Ist, Gleitzeit-Stand, Chef-Uebersicht), und der
// Excel-Export bekommt dafuer eine eigene Spalte (siehe src/lib/export/projektSpalten.ts).

export type EinfacheErfassungStatus = "aus" | "beantragt" | "an";

export const EINFACH_LABEL = "Ist-Zeit (ohne Projekt)";

export function normalisiereStatus(wert: string | null | undefined): EinfacheErfassungStatus {
  return wert === "an" || wert === "beantragt" ? wert : "aus";
}

export function istEinfacheErfassungAktiv(wert: string | null | undefined): boolean {
  return normalisiereStatus(wert) === "an";
}

export const STATUS_TEXT: Record<EinfacheErfassungStatus, string> = {
  aus: "aus (normale Erfassung mit Stempelzeiten und Projekten)",
  beantragt: "beantragt, wartet auf Freigabe durch den Chef",
  an: "aktiv",
};

/** Ist-Zeit aus dem Formular lesen: Dezimalstunden ("7.5", "7,5") oder Stunden:Minuten ("7:30"). */
export function parseIstZeit(eingabe: unknown): number | null {
  if (typeof eingabe !== "string") return null;
  const t = eingabe.trim().replace(",", ".");
  if (t === "") return 0;
  const hm = t.match(/^(\d{1,2}):(\d{2})$/);
  let stunden: number;
  if (hm) {
    const m = Number(hm[2]);
    if (m >= 60) return null;
    stunden = Number(hm[1]) + m / 60;
  } else {
    stunden = Number(t);
  }
  if (!Number.isFinite(stunden) || stunden < 0 || stunden > 24) return null;
  return Math.round(stunden * 100) / 100;
}
