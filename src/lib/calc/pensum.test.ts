import { describe, expect, it } from "vitest";
import { pensumFuerDatum, sollProTagFuerDatum } from "./pensum";

const basis = { anstellungPct: 1, wochenstunden: 42 }; // Soll/Tag 8.4

describe("pensumFuerDatum / sollProTagFuerDatum", () => {
  it("liefert die Basis, wenn kein Wechsel vorliegt", () => {
    expect(sollProTagFuerDatum("2026-05-01", basis, [])).toBeCloseTo(8.4, 9);
  });

  it("liefert die Basis für Tage vor dem ersten Wechsel", () => {
    const wechsel = [{ gueltigAb: "2026-07-01", anstellungPct: 0.8, wochenstunden: 42 }];
    expect(sollProTagFuerDatum("2026-06-30", basis, wechsel)).toBeCloseTo(8.4, 9);
  });

  it("wendet den Wechsel ab genau dem gueltigAb-Datum an", () => {
    const wechsel = [{ gueltigAb: "2026-07-01", anstellungPct: 0.8, wochenstunden: 42 }];
    expect(sollProTagFuerDatum("2026-07-01", basis, wechsel)).toBeCloseTo(6.72, 9);
    expect(sollProTagFuerDatum("2026-12-31", basis, wechsel)).toBeCloseTo(6.72, 9);
  });

  it("wählt bei mehreren Wechseln den zuletzt gültigen, unabhängig von der Reihenfolge im Array", () => {
    const wechsel = [
      { gueltigAb: "2026-09-01", anstellungPct: 0.6, wochenstunden: 42 },
      { gueltigAb: "2026-03-01", anstellungPct: 0.8, wochenstunden: 42 },
    ];
    expect(pensumFuerDatum("2026-01-15", basis, wechsel)).toEqual(basis);
    expect(pensumFuerDatum("2026-05-15", basis, wechsel).anstellungPct).toBeCloseTo(0.8, 9);
    expect(pensumFuerDatum("2026-10-15", basis, wechsel).anstellungPct).toBeCloseTo(0.6, 9);
  });
});
