import ExcelJS from "exceljs";
import path from "node:path";
import { berechneSoll, sollProTag, sollProTagFuerDatum, type PensumPeriode } from "@/lib/calc";

// Original-Vorlage (Arbeitsrapport_2026_kum.xlsx). Enthält bereits alle Formeln pro Monatsblatt
// (Soll/Ist/+/-/Stand, Ist-Zeit aus Stempelzeiten, Ferien-Kette, Jahres-Summen). Wir befüllen nur
// die Eingabezellen und lassen die Formeln unangetastet — siehe CLAUDE.md §6.
//
// Die Vorlage hat für jeden Monat eine FESTE Anzahl Tageszeilen, passend zu 2026 (kein
// Schaltjahr, Feb = 28 Tage/Zeilen). Da sich die Tageszahl pro Monat zwischen Kalenderjahren nur
// im Februar eines Schaltjahres unterscheidet (29 statt 28 Tage), funktioniert dieselbe Vorlage
// unverändert für JEDES NICHT-Schaltjahr — nur echte Schaltjahre (2028, 2032, …) sind nicht
// unterstützt, weil dafür in der Feb-Tabelle eine zusätzliche Zeile eingefügt werden müsste
// (inkl. Verschiebung aller Formelbezüge) — das ist bewusst (noch) nicht gebaut.
const TEMPLATE_PATH = path.join(process.cwd(), "src/lib/export/template-2026.xlsx");

export function istSchaltjahr(jahr: number): boolean {
  return (jahr % 4 === 0 && jahr % 100 !== 0) || jahr % 400 === 0;
}

const MONATSBLAETTER = [
  "Jan", "Feb", "Mar", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez",
] as const;

const PROJEKT_SPALTEN = ["C", "D", "E", "F", "G", "H", "I", "J", "K"] as const;
const STEMPEL_SPALTEN: Array<[string, string]> = [
  ["Y", "Z"],
  ["AA", "AB"],
  ["AC", "AD"],
  ["AE", "AF"],
];

export interface ExportBooking {
  label: string;
  hours: number;
}

export interface ExportStempelPaar {
  start: number | null; // Minuten seit Mitternacht
  stop: number | null;
}

export interface ExportTag {
  date: string; // YYYY-MM-DD
  bookings: ExportBooking[];
  krank: number;
  reisezeit: number;
  cad: number;
  ausbildung: number;
  buero: number;
  ferien: number;
  spesenFr: number;
  km: number;
  sollOverride: number | null;
  stempelzeiten: [ExportStempelPaar, ExportStempelPaar, ExportStempelPaar, ExportStempelPaar];
}

export interface ExportInput {
  companyName: string;
  userName: string;
  jahr: number;
  anstellungPct: number;
  wochenstunden: number;
  anzahlVorholtage: number;
  stundenuebertragAltesJahr: number;
  ferienuebertragAltesJahr: number;
  arbeitsmonate: number;
  kmSpesensatz: number;
  ferienBezogenBisher: number; // Jan!H2-Startwert, i.d.R. 0 für einen frischen Export
  /** App-eigenes Feature (CLAUDE.md §7): Tage davor bekommen Soll=0, siehe DailyEntry-Seite. */
  erfassungStartDatum?: string | null;
  /**
   * App-eigenes Feature: Pensumwechsel mitten im Jahr (siehe `src/lib/calc/pensum.ts` und
   * `/admin/pensum`). Die Vorlage kennt nur einen konstanten Soll-pro-Tag (Summen!$B$9), daher
   * wird für Tage, an denen der Wechsel bereits gilt, der Soll-Zellwert als Literal überschrieben.
   */
  pensumWechsel?: PensumPeriode[];
  feiertage: Array<{ date: string; label: string; bezahlt: boolean }>;
  tage: ExportTag[];
}

function daysInMonth(jahr: number, monatIndex0: number): number {
  return new Date(Date.UTC(jahr, monatIndex0 + 1, 0)).getUTCDate();
}

function setzeOderLeere(cell: ExcelJS.Cell, wert: number | null | undefined) {
  cell.value = wert && wert !== 0 ? wert : wert === 0 ? 0 : null;
}

export async function erzeugeExcelExport(input: ExportInput): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(TEMPLATE_PATH);

  // Die Original-Datei enthält bedingte Formatierungen mit einer Excel-Erweiterung (x14 extLst),
  // die exceljs beim Zurückschreiben nicht unterstützt (crasht in CfRuleXform). Rein optisch,
  // daher hier entfernt statt die ganze Export-Logik davon abhängig zu machen.
  for (const ws of workbook.worksheets) {
    (ws as unknown as { conditionalFormattings: unknown[] }).conditionalFormattings = [];
  }

  const summen = workbook.getWorksheet("Summen");
  if (!summen) throw new Error("Vorlage: Blatt 'Summen' fehlt");

  summen.getCell("B1").value = input.companyName;
  summen.getCell("B3").value = input.userName;
  summen.getCell("B5").value = input.anstellungPct;
  summen.getCell("B6").value = input.wochenstunden;
  summen.getCell("B10").value = input.anzahlVorholtage;
  summen.getCell("B14").value = input.stundenuebertragAltesJahr;
  summen.getCell("B15").value = input.ferienuebertragAltesJahr;
  summen.getCell("B17").value = input.arbeitsmonate;
  summen.getCell("B27").value = new Date(Date.UTC(input.jahr, 0, 1));
  summen.getCell("B44").value = input.kmSpesensatz;

  // Feiertage-Blatt: bestehende Liste (Zeilen 4-21) leeren, dann neu befüllen. Zeile 22/23
  // ("Wochenende"-Konstante) bewusst nicht anfassen.
  const feiertageSheet = workbook.getWorksheet("Feiertage");
  if (!feiertageSheet) throw new Error("Vorlage: Blatt 'Feiertage' fehlt");
  for (let r = 4; r <= 21; r++) {
    feiertageSheet.getCell(`B${r}`).value = null;
    feiertageSheet.getCell(`C${r}`).value = null;
    feiertageSheet.getCell(`D${r}`).value = null;
  }
  input.feiertage.forEach((f, i) => {
    const r = 4 + i;
    if (r > 21) return; // Sicherheitslimit, siehe Kommentar oben
    feiertageSheet.getCell(`B${r}`).value = new Date(f.date);
    feiertageSheet.getCell(`C${r}`).value = f.label;
    feiertageSheet.getCell(`D${r}`).value = f.bezahlt ? "ja" : "nein";
  });

  const tageByDate = new Map(input.tage.map((t) => [t.date, t]));
  const pensumWechsel = input.pensumWechsel ?? [];
  const pensumBasis = { anstellungPct: input.anstellungPct, wochenstunden: input.wochenstunden };
  const basisSollProTag = sollProTag(input.wochenstunden, input.anstellungPct);

  // Jan!H2 (Ferien "Bezogen"-Kette Startwert), siehe CLAUDE.md §2.
  const janSheet = workbook.getWorksheet("Jan");
  if (janSheet) janSheet.getCell("H2").value = input.ferienBezogenBisher;

  MONATSBLAETTER.forEach((sheetName, monatIndex0) => {
    const ws = workbook.getWorksheet(sheetName);
    if (!ws) return;

    const tageImMonat = daysInMonth(input.jahr, monatIndex0);
    const monatStr = String(monatIndex0 + 1).padStart(2, "0");

    // Projekt-Spaltenköpfe (Zeile 3, C-K) neu bestimmen: alle im Monat vorkommenden Labels,
    // in Reihenfolge des ersten Auftretens.
    const labelsImMonat: string[] = [];
    for (let tag = 1; tag <= tageImMonat; tag++) {
      const dateStr = `${input.jahr}-${monatStr}-${String(tag).padStart(2, "0")}`;
      const eintrag = tageByDate.get(dateStr);
      for (const b of eintrag?.bookings ?? []) {
        if (!labelsImMonat.includes(b.label)) labelsImMonat.push(b.label);
      }
    }
    PROJEKT_SPALTEN.forEach((col, i) => {
      ws.getCell(`${col}3`).value = labelsImMonat[i] ?? null;
    });

    for (let tag = 1; tag <= tageImMonat; tag++) {
      const row = 3 + tag;
      const dateStr = `${input.jahr}-${monatStr}-${String(tag).padStart(2, "0")}`;
      const eintrag = tageByDate.get(dateStr);

      // Projekt-Stunden gemäss oben bestimmter Spaltenreihenfolge
      PROJEKT_SPALTEN.forEach((col, i) => {
        const label = labelsImMonat[i];
        const stunden = label ? eintrag?.bookings.find((b) => b.label === label)?.hours : undefined;
        setzeOderLeere(ws.getCell(`${col}${row}`), stunden);
      });

      setzeOderLeere(ws.getCell(`L${row}`), eintrag?.krank ?? 0);
      setzeOderLeere(ws.getCell(`M${row}`), eintrag?.reisezeit ?? 0);
      setzeOderLeere(ws.getCell(`N${row}`), eintrag?.cad ?? 0);
      setzeOderLeere(ws.getCell(`O${row}`), eintrag?.ausbildung ?? 0);
      setzeOderLeere(ws.getCell(`P${row}`), eintrag?.buero ?? 0);
      setzeOderLeere(ws.getCell(`Q${row}`), eintrag?.ferien ?? 0);
      setzeOderLeere(ws.getCell(`V${row}`), eintrag?.spesenFr ?? 0);
      setzeOderLeere(ws.getCell(`W${row}`), eintrag?.km ?? 0);

      // Soll-Override: nur bei explizitem Override den Formel-Wert überschreiben (Literalwert,
      // analog zum Original-Excel bei manuellen Anpassungen — siehe CLAUDE.md §3/§7.2). Tage vor
      // dem individuellen Startdatum (§7 "leere Startphase") werden immer auf 0 gezwungen, auch
      // ohne eigenen DailyEntry-Datensatz.
      const vorStart = input.erfassungStartDatum != null && dateStr < input.erfassungStartDatum;
      if (vorStart) {
        ws.getCell(`R${row}`).value = 0;
      } else if (eintrag?.sollOverride != null) {
        ws.getCell(`R${row}`).value = eintrag.sollOverride;
      } else if (pensumWechsel.length > 0) {
        // Pensumwechsel mitten im Jahr: die Formel in R rechnet immer mit dem konstanten
        // Summen!$B$9 (Jahres-Basiswert) — weicht der für diesen Tag gültige Soll davon ab, muss
        // der Zellwert als Literal überschrieben werden (analog zum sollOverride-Fall oben).
        const resolvedSollProTag = sollProTagFuerDatum(dateStr, pensumBasis, pensumWechsel);
        if (resolvedSollProTag !== basisSollProTag) {
          ws.getCell(`R${row}`).value = berechneSoll(dateStr, resolvedSollProTag, input.feiertage, null);
        }
      }

      STEMPEL_SPALTEN.forEach(([startCol, stopCol], i) => {
        const paar = eintrag?.stempelzeiten[i];
        ws.getCell(`${startCol}${row}`).value =
          paar?.start != null ? paar.start / 1440 : null;
        ws.getCell(`${stopCol}${row}`).value = paar?.stop != null ? paar.stop / 1440 : null;
      });
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
