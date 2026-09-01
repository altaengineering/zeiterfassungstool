import { describe, expect, it } from "vitest";
import { berechnePlusMinus, berechneStand, berechneStandReihe } from "./stand";

describe("berechnePlusMinus / berechneStand", () => {
  it("plusMinus = Ist - Soll", () => {
    expect(berechnePlusMinus(9, 8.4)).toBeCloseTo(0.6, 9);
  });

  it("Stand = Stand Vortag + plusMinus", () => {
    expect(berechneStand(3, -1.4)).toBeCloseTo(1.6, 9);
  });
});

describe("berechneStandReihe", () => {
  it("rollt den Saldo über mehrere Tage fort, startend beim Vorjahresübertrag", () => {
    const reihe = berechneStandReihe(2, [0.6, -1.4, 0, 2.1]);
    const erwartet = [2.6, 1.2, 1.2, 3.3];
    reihe.forEach((wert, i) => expect(wert).toBeCloseTo(erwartet[i]!, 9));
  });

  it("läuft nahtlos über eine Monatsgrenze hinweg (Startwert = letzter Stand des Vormonats)", () => {
    const januar = berechneStandReihe(0, [0.4, -0.2]); // Stand Ende Januar = 0.2
    const standEndeJanuar = januar[januar.length - 1]!;
    const februar = berechneStandReihe(standEndeJanuar, [1, -0.5]);
    expect(februar[0]).toBeCloseTo(1.2, 9);
    expect(februar[1]).toBeCloseTo(0.7, 9);
  });
});
