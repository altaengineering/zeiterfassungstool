import { describe, expect, it } from "vitest";
import {
  berechnePlusMinus,
  berechneStand,
  berechneStandReihe,
  berechneUebertragAusAktuellemStundenSaldo,
} from "./stand";

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

describe("berechneUebertragAusAktuellemStundenSaldo", () => {
  it("zieht die diesjaehrigen Plus/Minus-Stunden vom aktuellen Saldo ab", () => {
    // Beispiel: jemand sagt "ich stehe gerade bei -5.5 Stunden", die App hat dieses Jahr bereits
    // +3 Stunden akkumuliert (startend bei Uebertrag 0) -> der tatsaechliche Alt-Uebertrag war -8.5.
    expect(berechneUebertragAusAktuellemStundenSaldo(-5.5, 3)).toBeCloseTo(-8.5, 9);
  });

  it("ist 0, wenn der aktuelle Saldo genau der diesjaehrigen Akkumulation entspricht", () => {
    expect(berechneUebertragAusAktuellemStundenSaldo(2.4, 2.4)).toBeCloseTo(0, 9);
  });

  it("rundtrip: Uebertrag + Akkumulation ergibt wieder den eingegebenen aktuellen Saldo", () => {
    const aktuellerSaldo = 12.3;
    const akkumuliert = -4.1;
    const uebertrag = berechneUebertragAusAktuellemStundenSaldo(aktuellerSaldo, akkumuliert);
    expect(berechneStand(uebertrag, akkumuliert)).toBeCloseTo(aktuellerSaldo, 9);
  });
});
