import { describe, expect, it } from "vitest";
import { istWochenende } from "./datum";

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
