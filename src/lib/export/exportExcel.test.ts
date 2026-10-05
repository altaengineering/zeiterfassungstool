import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { berechneTagesReihe, sollProTag, type DailyEntryInput } from "@/lib/calc";
import { erzeugeExcelExport, type ExportInput } from "./exportExcel";

const MONATE = ["Jan", "Feb", "Mar", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
const leer = { start: null, stop: null };

const feiertage = [
  { date: "2026-01-01", label: "Neujahr", bezahlt: true },
  { date: "2026-08-01", label: "Bundesfeier", bezahlt: true },
  { date: "2026-12-25", label: "Weihnachten", bezahlt: true },
];

const input: ExportInput = {
  companyName: "Alta Engineering AG",
  userName: "Stefan Testperson",
  jahr: 2026,
  anstellungPct: 0.8,
  wochenstunden: 42,
  anzahlVorholtage: 0,
  stundenuebertragAltesJahr: 12.5,
  ferienuebertragAltesJahr: 3,
  arbeitsmonate: 12,
  jahresferientage: 20,
  kmSpesensatz: 0.7,
  ferienBezogenBisher: 0,
  pensumWechsel: [],
  erfassungStartDatum: null,
  feiertage,
  projekte: [{ id: "p1", name: "Projekt A" }],
  tage: [
    {
      date: "2026-02-03", bookings: [{ projectId: "p1", label: "Projekt A", hours: 7.5 }], krank: 0, reisezeit: 0.5, cad: 0,
      ausbildung: 0, buero: 0, ferien: 0, spesenFr: 25, km: 40, sollOverride: null,
      stempelzeiten: [{ start: 480, stop: 1005 }, leer, leer, leer],
    },
    {
      date: "2026-03-10", bookings: [{ projectId: "p1", label: "Projekt A", hours: 4 }], krank: 0, reisezeit: 0, cad: 0,
      ausbildung: 0, buero: 0, ferien: 3.36, spesenFr: 0, km: 0, sollOverride: null,
      stempelzeiten: [leer, leer, leer, leer],
    },
    {
      date: "2026-09-01", bookings: [{ projectId: "p1", label: "Projekt A", hours: 8 }], krank: 0, reisezeit: 0, cad: 0,
      ausbildung: 0, buero: 0.5, ferien: 0, spesenFr: 12.5, km: 10, sollOverride: null,
      stempelzeiten: [{ start: 480, stop: 780 }, { start: 840, stop: 1020 }, leer, leer],
    },
  ],
};

async function ladeExport() {
  const buf = await erzeugeExcelExport(input);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  const res = (blatt: string, adresse: string): unknown => {
    const m = wb.getWorksheet(blatt)!.getCell(adresse).model as { result?: unknown; value?: unknown };
    return m.result !== undefined ? m.result : m.value;
  };
  return { wb, res };
}

// Hintergrund (Gleitzeit/Spesen/Name im Excel stimmten nicht): ExcelJS schreibt zu jeder Formel den
// alten, in der Vorlage mitgespeicherten Wert zurueck. In der Geschuetzten Ansicht und in
// Vorschauen rechnet Excel nicht neu, dort standen Name "Michael Kueng", der Stand der Vorlage und
// leere Spesen/Ist-Zeit-Spalten. Dieser Test liest die mitgespeicherten Werte direkt aus der Datei.
describe("Excel-Export: mitgespeicherte Formelwerte", () => {
  it("rechnet Soll, Ist, +/- und Stand aller 365 Tage identisch zur App-Berechnung", async () => {
    const byDate = new Map(input.tage.map((t) => [t.date, t]));
    const alleTage: string[] = [];
    for (const d = new Date(Date.UTC(2026, 0, 1)); d.getUTCFullYear() === 2026; d.setUTCDate(d.getUTCDate() + 1)) {
      alleTage.push(d.toISOString().slice(0, 10));
    }
    const eingaben: DailyEntryInput[] = alleTage.map((date) => {
      const e = byDate.get(date);
      return {
        date,
        projektStunden: e ? e.bookings.reduce((s, b) => s + b.hours, 0) : 0,
        krank: e?.krank ?? 0, reisezeit: e?.reisezeit ?? 0, cad: e?.cad ?? 0, ausbildung: e?.ausbildung ?? 0,
        buero: e?.buero ?? 0, ferien: e?.ferien ?? 0, sollOverride: e?.sollOverride ?? null,
        stempelzeiten: e ? e.stempelzeiten : [leer, leer, leer, leer],
      };
    });
    const referenz = berechneTagesReihe(eingaben, sollProTag(42, 0.8), feiertage, 12.5);
    const refByDate = new Map(referenz.map((r) => [r.date, r]));

    const { res } = await ladeExport();
    const abweichungen: string[] = [];
    MONATE.forEach((m, mi) => {
      const tage = new Date(Date.UTC(2026, mi + 1, 0)).getUTCDate();
      for (let t = 1; t <= tage; t++) {
        const date = `2026-${String(mi + 1).padStart(2, "0")}-${String(t).padStart(2, "0")}`;
        const ref = refByDate.get(date)!;
        const row = 3 + t;
        for (const [spalte, erwartet] of [["R", ref.soll], ["S", ref.ist], ["T", ref.plusMinus], ["U", ref.stand]] as const) {
          const ist = res(m, `${spalte}${row}`);
          if (typeof ist !== "number" || Math.abs(ist - erwartet) > 1e-6) {
            abweichungen.push(`${m} ${spalte}${row} (${date}): Excel=${JSON.stringify(ist)} App=${erwartet}`);
          }
        }
      }
    });
    expect(abweichungen).toEqual([]);
  }, 60_000);

  it("zeigt den Namen der exportierten Person in allen Monatsblaettern, nicht den der Vorlage", async () => {
    const { res } = await ladeExport();
    for (const m of MONATE) expect(res(m, "J1")).toBe("Stefan Testperson");
    expect(res("Summen", "B3")).toBe("Stefan Testperson");
  }, 60_000);

  it("fuellt Spesen und die Ist-Zeit-Spalten hinten in der Tabelle", async () => {
    const { res } = await ladeExport();
    // 2026-09-01: Spesen 12.5 Fr + 10 km * 0.7 = 19.5, Stempelzeiten 08:00-13:00 + 14:00-17:00 = 8 h
    expect(res("Sep", "X4")).toBeCloseTo(19.5, 9);
    expect(res("Sep", "AH4")).toBe(8);
    expect(res("Sep", "AI4")).toBeCloseTo(0, 9);
    expect(res("Sep", "AJ4")).toBeCloseTo(8, 9);
    // 2026-02-03 (Zeile 6): 08:00-16:45 = 8.75 h
    expect(res("Feb", "AJ6")).toBeCloseTo(8.75, 9);
    expect(res("Summen", "D56")).toBeCloseTo(19.5, 9);
  }, 60_000);

  it("enthaelt keine Excel-Fehlerwerte und keine festen Soll-Nullen aus der Vorlage", async () => {
    const { wb, res } = await ladeExport();
    let fehlerzellen = 0;
    wb.eachSheet((ws) =>
      ws.eachRow((row) =>
        row.eachCell((c) => {
          const r = (c.model as { result?: { error?: string } }).result;
          if (r && typeof r === "object" && r.error) fehlerzellen++;
        }),
      ),
    );
    expect(fehlerzellen).toBe(0);
    // Die Vorlage hatte in Januar bis Juni fest eingetipptes Soll=0 an normalen Arbeitstagen.
    // Montag, 5. Januar 2026 (Zeile 8) muss das volle Tages-Soll haben: 42 h / 5 * 0.8 = 6.72.
    expect(res("Jan", "R8")).toBeCloseTo(6.72, 9);
    expect(wb.getWorksheet("Jan")!.getCell("R8").type).toBe(ExcelJS.ValueType.Formula);
  }, 60_000);
});
