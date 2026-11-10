import { describe, expect, it } from "vitest";
import { istEinfacheErfassungAktiv, normalisiereStatus, parseIstZeit } from "./einfacheErfassung";

describe("einfache Erfassung", () => {
  it("ist nur mit Status an aktiv", () => {
    expect(istEinfacheErfassungAktiv("an")).toBe(true);
    expect(istEinfacheErfassungAktiv("beantragt")).toBe(false);
    expect(istEinfacheErfassungAktiv("aus")).toBe(false);
    expect(istEinfacheErfassungAktiv(null)).toBe(false);
    expect(normalisiereStatus("irgendwas")).toBe("aus");
  });

  it("liest die Ist-Zeit als Dezimalzahl oder Stunden:Minuten", () => {
    expect(parseIstZeit("8")).toBe(8);
    expect(parseIstZeit("7.5")).toBe(7.5);
    expect(parseIstZeit("7,25")).toBe(7.25);
    expect(parseIstZeit("7:30")).toBe(7.5);
    expect(parseIstZeit("8:20")).toBe(8.33);
    expect(parseIstZeit("")).toBe(0);
  });

  it("lehnt Unsinn ab", () => {
    expect(parseIstZeit("25")).toBeNull();
    expect(parseIstZeit("-1")).toBeNull();
    expect(parseIstZeit("7:75")).toBeNull();
    expect(parseIstZeit("abc")).toBeNull();
    expect(parseIstZeit(undefined)).toBeNull();
  });
});
