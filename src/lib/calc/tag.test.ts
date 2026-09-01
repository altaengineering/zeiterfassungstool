import { describe, expect, it } from "vitest";
import { berechneTagesReihe } from "./tag";
import type { DailyEntryInput, Feiertag } from "./types";
import fixture from "./__fixtures__/jun-2026-michael-kueng.json";

// Reale Daten aus Arbeitsrapport_2026_kum.xlsx, Blatt "Jun" (Michael Küng), per openpyxl mit
// data_only=True extrahiert. Deckt sowohl formel-basierte Tage als auch manuell überschriebene
// Soll-Werte (sollOverride) ab. Toleranz wegen Float-Rundung in Excel vs. JS.
const EPSILON = 1e-9;

describe("berechneTagesReihe – Regression gegen Original-Excel (Jun 2026, Michael Küng)", () => {
  const feiertage = fixture.feiertage as Feiertag[];
  const entries: DailyEntryInput[] = fixture.days.map((d) => ({
    date: d.date,
    projektStunden: d.projektStunden,
    krank: d.krank,
    reisezeit: d.reisezeit,
    cad: d.cad,
    ausbildung: d.ausbildung,
    buero: d.buero,
    ferien: d.ferien,
    sollOverride: d.sollOverride,
    stempelzeiten: d.stempelzeiten as DailyEntryInput["stempelzeiten"],
  }));

  const ergebnisse = berechneTagesReihe(entries, fixture.sollProTag, feiertage, fixture.startStand);

  it("berechnet für jeden Tag exakt die Werte aus der Original-Datei", () => {
    ergebnisse.forEach((ergebnis, i) => {
      const erwartet = fixture.days[i]!.expected;
      expect(ergebnis.soll, `soll @ ${ergebnis.date}`).toBeCloseTo(erwartet.soll, 6);
      expect(ergebnis.ist, `ist @ ${ergebnis.date}`).toBeCloseTo(erwartet.ist, 6);
      expect(ergebnis.plusMinus, `plusMinus @ ${ergebnis.date}`).toBeCloseTo(erwartet.plusMinus, 6);
      expect(ergebnis.stand, `stand @ ${ergebnis.date}`).toBeCloseTo(erwartet.stand, 6);
      expect(
        ergebnis.istZeitAusStempelzeiten,
        `istZeitAusStempelzeiten @ ${ergebnis.date}`,
      ).toBeCloseTo(erwartet.istZeitAusStempelzeiten, 6);
      expect(ergebnis.aufteilungIstzeit, `aufteilungIstzeit @ ${ergebnis.date}`).toBeCloseTo(
        erwartet.aufteilungIstzeit,
        6,
      );
    });
  });

  it("rollt den Stand korrekt über den ganzen Monat fort (letzter Tag = Monatsstand)", () => {
    const letzterTag = ergebnisse[ergebnisse.length - 1]!;
    const erwarteterLetzterStand = fixture.days[fixture.days.length - 1]!.expected.stand;
    expect(letzterTag.stand).toBeCloseTo(erwarteterLetzterStand, 6);
  });

  it("hat für Tage mit sollOverride den überschriebenen Wert übernommen, nicht die Formel", () => {
    const tageMitOverride = fixture.days.filter((d) => d.sollOverride !== null);
    expect(tageMitOverride.length).toBeGreaterThan(0);
    for (const tag of tageMitOverride) {
      const ergebnis = ergebnisse.find((e) => e.date === tag.date)!;
      expect(ergebnis.soll).toBeCloseTo(tag.sollOverride as number, EPSILON);
    }
  });
});
