import { describe, expect, it } from "vitest";
import { arbeitstageImZeitraum, istWochenende } from "./datum";

describe("istWochenende", () => {
  it("erkennt Samstag und Sonntag als Wochenende", () => {
    expect(istWochenende("2026-01-03")).toBe(true); // Samstag
    expect(istWochenende("2026-01-04")).toBe(true); // Sonntag
  });

  it("erkennt Werktage nicht als Wochenende", () => {
    expect(istWochenende("2026-01-01")).toBe(false); // Donnerstag (Neujahr, aber kein Wochenende)
    expect(istWochenende("2026-01-02")).toBe(false); // Freitag
  });
});

describe("arbeitstageImZeitraum", () => {
  it("zählt eine volle Woche als 5 Arbeitstage", () => {
    // Mo 2026-01-05 bis So 2026-01-11
    const tage = arbeitstageImZeitraum("2026-01-05", "2026-01-11", new Set());
    expect(tage).toEqual([
      "2026-01-05",
      "2026-01-06",
      "2026-01-07",
      "2026-01-08",
      "2026-01-09",
    ]);
  });

  it("lässt bezahlte Feiertage innerhalb des Zeitraums weg", () => {
    const tage = arbeitstageImZeitraum("2026-01-05", "2026-01-09", new Set(["2026-01-07"]));
    expect(tage).toEqual(["2026-01-05", "2026-01-06", "2026-01-08", "2026-01-09"]);
  });

  it("funktioniert über eine Monatsgrenze hinweg", () => {
    // Fr 2026-01-30 bis Mo 2026-02-02
    const tage = arbeitstageImZeitraum("2026-01-30", "2026-02-02", new Set());
    expect(tage).toEqual(["2026-01-30", "2026-02-02"]);
  });

  it("ist leer, wenn der ganze Zeitraum ein Wochenende ist", () => {
    expect(arbeitstageImZeitraum("2026-01-10", "2026-01-11", new Set())).toEqual([]);
  });

  it("ein einzelner Arbeitstag als von=bis ergibt genau diesen einen Tag", () => {
    expect(arbeitstageImZeitraum("2026-01-05", "2026-01-05", new Set())).toEqual(["2026-01-05"]);
  });
});
