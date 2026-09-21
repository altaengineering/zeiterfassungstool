import { describe, expect, it } from "vitest";
import {
  berechneFerienBezogen,
  berechneFerienBezogenGesamt,
  berechneFerienGuthaben,
  berechneFerienuebertragNaechstesJahr,
  STANDARD_JAHRESFERIENTAGE,
} from "./ferien";

// Referenzwerte aus Arbeitsrapport_2026_kum.xlsx, Blatt "Summen" (Michael Küng, 2026):
// B16=10.830000003333332, B18=10.8, B19=1, B20=9.8, B9(Soll/Tag)=8.4

describe("STANDARD_JAHRESFERIENTAGE", () => {
  it("entspricht der Original-Formel 6.5/12*20-0.00333333", () => {
    expect(STANDARD_JAHRESFERIENTAGE).toBeCloseTo(10.830000003333332, 9);
  });
});

describe("berechneFerienGuthaben", () => {
  it("entspricht Summen!B18 (Beispiel Michael Küng 2026)", () => {
    const guthaben = berechneFerienGuthaben(0, 12, STANDARD_JAHRESFERIENTAGE);
    expect(guthaben).toBeCloseTo(10.8, 9);
  });
});

describe("berechneFerienBezogen", () => {
  it("summiert Ferien-Stunden über mehrere Monate und rechnet in Tage um", () => {
    // Beispiel: 8.4h Ferien in einem Monat, Soll-pro-Tag=8.4 -> genau 1 Tag bezogen
    expect(berechneFerienBezogen([8.4, 0, 0], 8.4)).toBeCloseTo(1, 9);
  });

  it("ist 0, wenn keine Ferien bezogen wurden", () => {
    expect(berechneFerienBezogen([0, 0, 0], 8.4)).toBe(0);
  });
});

describe("berechneFerienBezogenGesamt", () => {
  it("addiert die manuelle Korrektur zu den echten Tageseintraegen", () => {
    expect(berechneFerienBezogenGesamt(1, 5)).toBe(6);
  });

  it("ist gleich den echten Tageseintraegen, wenn keine Korrektur eingetragen ist", () => {
    expect(berechneFerienBezogenGesamt(1, 0)).toBe(1);
  });
});

describe("berechneFerienuebertragNaechstesJahr", () => {
  it("entspricht Summen!B20 = Guthaben - bezogen (Beispiel Michael Küng 2026)", () => {
    expect(berechneFerienuebertragNaechstesJahr(10.8, 1)).toBeCloseTo(9.8, 9);
  });
});
