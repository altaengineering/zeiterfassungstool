import { describe, expect, it } from "vitest";
import {
  berechneFerienBezogen,
  berechneFerienBezogenGesamt,
  berechneFerienGuthaben,
  berechneFerienuebertragNaechstesJahr,
  STANDARD_JAHRESFERIENTAGE,
} from "./ferien";

// Referenzwerte aus Arbeitsrapport_2026_kum.xlsx, Blatt "Summen" (Michael Küng, 2026), nur fuer
// die reinen Formel-Funktionen unten noch relevant (B18/B20), NICHT mehr fuer
// STANDARD_JAHRESFERIENTAGE selbst: der alte Excel-Wert (B16=10.83) wurde am 2026-09-23 von
// Michael ausdruecklich als falsch korrigiert, siehe Kommentar in ferien.ts.

describe("STANDARD_JAHRESFERIENTAGE", () => {
  it("entspricht 4 Wochen Ferien pro Jahr (20 Tage)", () => {
    expect(STANDARD_JAHRESFERIENTAGE).toBe(20);
  });
});

describe("berechneFerienGuthaben", () => {
  it("entspricht Summen!B18-Formel bei vollem Jahr und 10.8 Tagen Anspruch", () => {
    const guthaben = berechneFerienGuthaben(0, 12, 10.83);
    expect(guthaben).toBeCloseTo(10.8, 9);
  });

  it("bei 20 Tagen Standardanspruch und vollem Jahr ergibt Guthaben genau 20", () => {
    const guthaben = berechneFerienGuthaben(0, 12, STANDARD_JAHRESFERIENTAGE);
    expect(guthaben).toBe(20);
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
