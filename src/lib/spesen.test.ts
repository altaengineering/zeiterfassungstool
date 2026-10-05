import { describe, expect, it } from "vitest";
import { berechneSpesenSumme, STANDARD_KM_SPESENSATZ } from "./spesen";

describe("berechneSpesenSumme", () => {
  it("rechnet Kilometer mal Satz plus weitere Spesen", () => {
    expect(berechneSpesenSumme(12.5, 10, 0.7)).toBe(19.5);
  });

  it("nur Kilometer: 36 km zu Fr. 0.70 sind Fr. 25.20", () => {
    expect(berechneSpesenSumme(0, 36, STANDARD_KM_SPESENSATZ)).toBe(25.2);
  });

  it("ohne Eintraege ist die Summe 0", () => {
    expect(berechneSpesenSumme(0, 0, 0.7)).toBe(0);
  });
});
