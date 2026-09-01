import { describe, expect, it } from "vitest";
import { berechneAufteilungIstzeit, berechneIst, berechneIstZeitAusStempelzeiten } from "./ist";
import type { StempelPaar } from "./types";

describe("berechneIst", () => {
  it("summiert Projekt- und alle Kategorie-Stunden (Spalten C-Q)", () => {
    const ist = berechneIst({
      projektStunden: 5,
      krank: 1,
      reisezeit: 0.5,
      cad: 2,
      ausbildung: 0,
      buero: 0,
      ferien: 0,
    });
    expect(ist).toBeCloseTo(8.5, 9);
  });
});

describe("berechneIstZeitAusStempelzeiten", () => {
  it("summiert 4 Start/Stop-Paare zu Dezimalstunden (AJ = AH + AI)", () => {
    const paare: [StempelPaar, StempelPaar, StempelPaar, StempelPaar] = [
      { start: 8 * 60, stop: 12 * 60 }, // 08:00-12:00 = 4h
      { start: 13 * 60, stop: 17 * 60 + 30 }, // 13:00-17:30 = 4.5h
      { start: null, stop: null },
      { start: null, stop: null },
    ];
    const result = berechneIstZeitAusStempelzeiten(paare);
    expect(result.totalMinuten).toBe(8 * 60 + 30);
    expect(result.stunden).toBe(8);
    expect(result.minutenAlsDezimal).toBeCloseTo(0.5, 9);
    expect(result.dezimalstunden).toBeCloseTo(8.5, 9);
  });

  it("behandelt fehlende Start/Stop-Werte wie leere Excel-Zellen (0)", () => {
    const paare: [StempelPaar, StempelPaar, StempelPaar, StempelPaar] = [
      { start: null, stop: null },
      { start: null, stop: null },
      { start: null, stop: null },
      { start: null, stop: null },
    ];
    expect(berechneIstZeitAusStempelzeiten(paare).dezimalstunden).toBe(0);
  });
});

describe("berechneAufteilungIstzeit", () => {
  it("ist 0, wenn gebuchte Kategorien exakt den Stempelzeiten entsprechen", () => {
    expect(berechneAufteilungIstzeit(8.5, 8.5)).toBeCloseTo(0, 9);
  });

  it("zeigt die Differenz, wenn Kategorien und Stempelzeiten abweichen", () => {
    expect(berechneAufteilungIstzeit(8.4, 8.5)).toBeCloseTo(-0.1, 9);
  });
});
