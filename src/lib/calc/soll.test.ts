import { describe, expect, it } from "vitest";
import { berechneSoll, sollProTag } from "./soll";
import type { Feiertag } from "./types";

describe("sollProTag", () => {
  it("entspricht Summen!B9 = Wochenstunden/5*Anstellung%", () => {
    expect(sollProTag(42, 1)).toBeCloseTo(8.4, 9);
    expect(sollProTag(42, 0.5)).toBeCloseTo(4.2, 9);
  });
});

describe("berechneSoll", () => {
  const feiertage: Feiertag[] = [
    { date: "2026-01-01", label: "Neujahr", bezahlt: true },
    { date: "2026-04-06", label: "Ostermontag", bezahlt: false },
  ];

  it("ist 0 am Wochenende", () => {
    expect(berechneSoll("2026-01-03", 8.4, feiertage)).toBe(0); // Samstag
  });

  it("ist 0 an einem bezahlten Feiertag", () => {
    expect(berechneSoll("2026-01-01", 8.4, feiertage)).toBe(0); // Neujahr, bezahlt=ja
  });

  it("ist der volle Tages-Soll an einem UNbezahlten Feiertag (Entscheidung CLAUDE.md §7.1)", () => {
    expect(berechneSoll("2026-04-06", 8.4, feiertage)).toBe(8.4); // Ostermontag, bezahlt=nein
  });

  it("ist der volle Tages-Soll an einem normalen Werktag", () => {
    expect(berechneSoll("2026-01-02", 8.4, feiertage)).toBe(8.4); // Freitag, kein Feiertag
  });

  it("sollOverride hat Vorrang vor Wochenende/Feiertag-Logik (CLAUDE.md §7.2)", () => {
    expect(berechneSoll("2026-01-02", 8.4, feiertage, 0)).toBe(0);
    expect(berechneSoll("2026-01-03", 8.4, feiertage, 5)).toBe(5); // überschreibt auch Wochenende
  });

  it("ignoriert override, wenn null/undefined", () => {
    expect(berechneSoll("2026-01-02", 8.4, feiertage, null)).toBe(8.4);
    expect(berechneSoll("2026-01-02", 8.4, feiertage, undefined)).toBe(8.4);
  });
});
