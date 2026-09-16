// Datum des Firmeneintritts pro Person, per E-Mail (aus der von Michael gelieferten Liste
// "MA_2026.xlsx", Stand 16.9.2026). Bewusst hier als fester Code statt Formular, weil es sich um
// eine einmalige Korrektur bestehender, feststehender HR-Fakten handelt, keine Daten, die
// Nutzer:innen selbst pflegen. Wird über den Knopf "Dienstalter importieren" auf /admin (siehe
// actions.ts, dienstalterImportieren) per E-Mail-Abgleich in User.eintrittsdatum geschrieben.
// Wer hier fehlt (z.B. Stefan Herger, nicht in der Liste enthalten), behält `eintrittsdatum: null`
// und wird bei der Sortierung ans Ende gestellt statt geraten, siehe vergleicheDienstalter().
export const DIENSTALTER: Record<string, string> = {
  "d.gruber@alta-engineering.ch": "2019-01-01",
  "f.kurzmeyer@alta-engineering.ch": "2022-06-01",
  "m.sidler@alta-engineering.ch": "2023-06-01",
  "d.hofmann@alta-engineering.ch": "2024-03-01",
  "t.kempf@alta-engineering.ch": "2025-06-01",
  "m.czekalla@alta-engineering.ch": "2025-08-01",
  "s.steiner@alta-engineering.ch": "2025-10-01",
  "s.zihlmann@alta-engineering.ch": "2025-11-01",
  "f.christen@alta-engineering.ch": "2026-02-01",
  "a.stojkaj@alta-engineering.ch": "2026-02-01",
  "s.mohler@alta-engineering.ch": "2026-05-01",
  "r.vonlanthen@alta-engineering.ch": "2026-06-01",
  "m.kueng@alta-engineering.ch": "2026-06-15",
};

interface HatDienstalter {
  eintrittsdatum: Date | null;
  name: string;
}

// Aelteste (frueheste eintrittsdatum) zuerst. Personen ohne bekanntes Eintrittsdatum (z.B. noch
// nicht importiert, oder schlicht nicht in der Liste) werden ans Ende gestellt statt vorne oder
// per Rateverfahren einsortiert zu werden, dann alphabetisch nach Namen.
export function vergleicheDienstalter(a: HatDienstalter, b: HatDienstalter): number {
  if (a.eintrittsdatum && b.eintrittsdatum) {
    return a.eintrittsdatum.getTime() - b.eintrittsdatum.getTime();
  }
  if (a.eintrittsdatum && !b.eintrittsdatum) return -1;
  if (!a.eintrittsdatum && b.eintrittsdatum) return 1;
  return a.name.localeCompare(b.name);
}
