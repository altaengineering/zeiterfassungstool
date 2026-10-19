import { describe, expect, it } from "vitest";
import { addTage, feiertagFuerJahr, ostersonntag } from "./ostern";

describe("ostersonntag", () => {
  it("liefert bekannte Daten", () => {
    expect(ostersonntag(2025)).toBe("2025-04-20");
    expect(ostersonntag(2026)).toBe("2026-04-05");
    expect(ostersonntag(2027)).toBe("2027-03-28");
    expect(ostersonntag(2028)).toBe("2028-04-16");
    expect(ostersonntag(2030)).toBe("2030-04-21");
  });
});

describe("addTage", () => {
  it("rechnet über Monats- und Jahresgrenzen", () => {
    expect(addTage("2026-12-31", 1)).toBe("2027-01-01");
    expect(addTage("2027-03-01", -1)).toBe("2027-02-28");
  });
});

describe("feiertagFuerJahr", () => {
  it("bildet die Feiertage 2026 aus Ostern korrekt nach", () => {
    expect(feiertagFuerJahr("Karfreitag", "2025-04-18", 2026)).toBe("2026-04-03");
    expect(feiertagFuerJahr("Ostermontag", "2025-04-21", 2026)).toBe("2026-04-06");
    expect(feiertagFuerJahr("Auffahrt", "2025-05-29", 2026)).toBe("2026-05-14");
    expect(feiertagFuerJahr("Pfingstmontag", "2025-06-09", 2026)).toBe("2026-05-25");
    expect(feiertagFuerJahr("Fronleichnam", "2025-06-19", 2026)).toBe("2026-06-04");
  });

  it("berechnet die beweglichen Feiertage 2027", () => {
    expect(feiertagFuerJahr("Karfreitag", "2026-04-03", 2027)).toBe("2027-03-26");
    expect(feiertagFuerJahr("Ostermontag", "2026-04-06", 2027)).toBe("2027-03-29");
    expect(feiertagFuerJahr("Auffahrt", "2026-05-14", 2027)).toBe("2027-05-06");
    expect(feiertagFuerJahr("Pfingstmontag", "2026-05-25", 2027)).toBe("2027-05-17");
    expect(feiertagFuerJahr("Fronleichnam", "2026-06-04", 2027)).toBe("2027-05-27");
  });

  it("lässt feste Feiertage auf demselben Tag", () => {
    expect(feiertagFuerJahr("Neujahr", "2026-01-01", 2027)).toBe("2027-01-01");
    expect(feiertagFuerJahr("Nationalfeiertag", "2026-08-01", 2027)).toBe("2027-08-01");
    expect(feiertagFuerJahr("Stephanstag", "2026-12-26", 2027)).toBe("2027-12-26");
  });
});
