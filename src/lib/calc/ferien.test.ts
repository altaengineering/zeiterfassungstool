import { describe, expect, it } from "vitest";
import {
  berechneFerienBezogen,
  berechneFerienBezogenGesamt,
  berechneFerienGuthaben,
  berechneFerienuebertragNaechstesJahr,
  berechneUebertragAusAktuellemSaldo,
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

describe("berechneUebertragAusAktuellemSaldo", () => {
  it("regressiert den Vorfall vom 2026-09-23 (Michael Küng: 8.8 eingetragen, Anzeige sprang auf 17.8)", () => {
    // 11 Tage bereits bezogen, voller Jahresanspruch (20 Tage) -> ohne Rueckrechnung wuerde ein
    // direkt gespeicherter Uebertrag von 8.8 zu einem Guthaben von 28.8 und einem angezeigten
    // "noch uebrig" von 17.8 fuehren (28.8 - 11). Die Rueckrechnung muss stattdessen einen
    // Uebertrag liefern, der nach dem selben Guthaben-abzueglich-bezogen-Schema wieder auf die
    // eingegebenen 8.8 fuehrt.
    const uebertrag = berechneUebertragAusAktuellemSaldo(8.8, 11, 12, 20);
    const guthaben = berechneFerienGuthaben(uebertrag, 12, 20);
    const ergebnisSaldo = berechneFerienuebertragNaechstesJahr(guthaben, 11);
    expect(ergebnisSaldo).toBeCloseTo(8.8, 9);
  });

  it("ergibt 0 Uebertrag, wenn der aktuelle Saldo exakt dem anteiligen Jahresanspruch minus bezogen entspricht", () => {
    expect(berechneUebertragAusAktuellemSaldo(20, 0, 12, 20)).toBeCloseTo(0, 9);
  });

  it("kann negativ werden, wenn schon mehr bezogen wurde als der anteilige Anspruch hergibt", () => {
    expect(berechneUebertragAusAktuellemSaldo(0, 25, 12, 20)).toBeCloseTo(5, 9);
  });

  it("beruecksichtigt einen anteiligen Jahresanspruch bei Eintritt waehrend des Jahres", () => {
    // Halbes Jahr (6 von 12 Monaten), 20 Tage/Jahr -> 10 Tage anteiliger Anspruch.
    expect(berechneUebertragAusAktuellemSaldo(5, 2, 6, 20)).toBeCloseTo(5 + 2 - 10, 9);
  });
});
