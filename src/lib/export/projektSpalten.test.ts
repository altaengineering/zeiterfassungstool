import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { erzeugeExcelExport, type ExportInput } from "./exportExcel";
import { ordneProjektSpalten, SAMMEL_SPALTE_ID } from "./projektSpalten";

const aktiv = (id: string, name: string) => ({ id, name, aktiv: true });
const inaktiv = (id: string, name: string) => ({ id, name, aktiv: false });

describe("ordneProjektSpalten", () => {
  it("aktive Projekte kommen zuerst in fester Reihenfolge, auch ohne Stunden", () => {
    const { spalten } = ordneProjektSpalten([aktiv("a", "Website"), aktiv("b", "NBU")], []);
    expect(spalten.map((s) => s.name)).toEqual(["Website", "NBU"]);
  });

  it("Buchungen auf ein deaktiviertes Projekt bekommen eine eigene Spalte statt zu verschwinden", () => {
    const { spalten, spaltenIdFuer } = ordneProjektSpalten(
      [aktiv("a", "Website"), inaktiv("x", "Altprojekt")],
      [{ projectId: "x", label: "Altprojekt", hours: 5 }],
    );
    expect(spalten.map((s) => s.name)).toEqual(["Website", "Altprojekt"]);
    expect(spaltenIdFuer({ projectId: "x", label: "Altprojekt" })).toBe("x");
  });

  it("Buchungen ohne Projekt-Verknuepfung (Projekt geloescht) landen in der gleichnamigen Spalte oder einer neuen", () => {
    const { spalten, spaltenIdFuer } = ordneProjektSpalten(
      [aktiv("a", "Website")],
      [
        { projectId: null, label: "Website", hours: 2 },
        { projectId: null, label: "Geloeschtes Projekt", hours: 3 },
      ],
    );
    expect(spaltenIdFuer({ projectId: null, label: "Website" })).toBe("a");
    expect(spalten.map((s) => s.name)).toEqual(["Website", "Geloeschtes Projekt"]);
  });

  it("verliert bei mehr als 9 Projekten keine Stunden: Sammelspalte, unbenutzte Spalten fallen zuerst weg", () => {
    const projekte = Array.from({ length: 12 }, (_, i) => aktiv(`p${i}`, `Projekt ${i}`));
    // nur 10 der 12 haben Stunden -> 2 leere Spalten fallen weg, 10 > 9 -> Sammelspalte
    const buchungen = Array.from({ length: 10 }, (_, i) => ({ projectId: `p${i}`, label: `Projekt ${i}`, hours: 1 }));
    const { spalten, spaltenIdFuer } = ordneProjektSpalten(projekte, buchungen);
    expect(spalten).toHaveLength(9);
    expect(spalten[8]!.id).toBe(SAMMEL_SPALTE_ID);
    const ids = new Set(spalten.map((s) => s.id));
    for (const b of buchungen) expect(ids.has(spaltenIdFuer(b))).toBe(true);
    expect(spaltenIdFuer({ projectId: "p9", label: "Projekt 9" })).toBe(SAMMEL_SPALTE_ID);
    expect(spaltenIdFuer({ projectId: "p0", label: "Projekt 0" })).toBe("p0");
  });
});

describe("Excel-Export: Ist entspricht allen Buchungen", () => {
  it("summiert mehrere Buchungen auf dasselbe Projekt am selben Tag", async () => {
    const leer = { start: null, stop: null };
    const input: ExportInput = {
      companyName: "Alta Engineering AG",
      userName: "Testperson",
      jahr: 2026,
      anstellungPct: 1,
      wochenstunden: 42,
      anzahlVorholtage: 0,
      stundenuebertragAltesJahr: 0,
      ferienuebertragAltesJahr: 0,
      arbeitsmonate: 12,
      jahresferientage: 20,
      kmSpesensatz: 0.7,
      ferienBezogenBisher: 0,
      pensumWechsel: [],
      erfassungStartDatum: null,
      feiertage: [],
      projekte: [{ id: "p1", name: "Projekt A" }],
      tage: [
        {
          date: "2026-09-08",
          bookings: [
            { projectId: "p1", label: "Projekt A", hours: 3 },
            { projectId: "p1", label: "Projekt A", hours: 4.5 },
          ],
          krank: 0, reisezeit: 0, cad: 0, ausbildung: 0, buero: 0, ferien: 0, spesenFr: 0, km: 0, sollOverride: null,
          stempelzeiten: [leer, leer, leer, leer],
        },
      ],
    };
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await erzeugeExcelExport(input)) as unknown as ArrayBuffer);
    const m = (a: string) => (wb.getWorksheet("Sep")!.getCell(a).model as { result?: unknown; value?: unknown });
    // 8. September = Zeile 11, Projekt A = Spalte C
    expect(m("C11").value).toBeCloseTo(7.5, 9);
    expect(m("S11").result).toBeCloseTo(7.5, 9);
  }, 60_000);
});
