import ExcelJS from "exceljs";
import FormulaParser from "fast-formula-parser";

const FormulaError = FormulaParser.FormulaError;
type FormulaError = InstanceType<typeof FormulaError>;

// Warum es das gibt: ExcelJS schreibt zu jeder Formel den bei der Vorlage mitgespeicherten Wert
// ("cached value") unveraendert zurueck. fullCalcOnLoad laesst Excel beim Oeffnen zwar alles neu
// rechnen, aber NICHT in der Geschuetzten Ansicht (Standard bei heruntergeladenen Dateien) und auch
// nicht in Vorschauen (Outlook, Browser, Handy). Dort standen deshalb noch Name, Gleitzeit-Stand,
// Spesen-Summen und Ist-Zeit-Spalten aus der Vorlage (bzw. leer). Darum rechnen wir hier jede Formel
// der befuellten Mappe selbst aus und schreiben den richtigen Wert als Cache mit.
//
// Die Auswertung laeuft bewusst iterativ in Abhaengigkeits-Reihenfolge und nicht rekursiv: der Parser
// ist nicht re-entrant (ein verschachtelter parse()-Aufruf aus onCell heraus verfaelscht den aeusseren).

const EXCEL_EPOCH_OFFSET_TAGE = 25569; // Tage zwischen 1899-12-30 und 1970-01-01
const MAX_ZEILE_GANZE_SPALTE = 1000; // Vorlage-Blaetter haben 1000 Zeilen, siehe exportExcel.ts

type Zellwert = number | string | boolean | FormulaError | null;

interface Position {
  sheet: string;
  row: number;
  col: number;
}

const schluessel = (p: Position) => `${p.sheet}!${p.row},${p.col}`;

function alsSeriennummer(d: Date): number {
  return d.getTime() / 86_400_000 + EXCEL_EPOCH_OFFSET_TAGE;
}

function literalWert(v: unknown): Zellwert {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return alsSeriennummer(v);
  if (typeof v === "number" || typeof v === "string" || typeof v === "boolean") return v;
  if (typeof v === "object") {
    const o = v as { richText?: Array<{ text: string }>; text?: string };
    if (Array.isArray(o.richText)) return o.richText.map((r) => r.text).join("");
    if (typeof o.text === "string") return o.text;
  }
  return null;
}

// Der Parser rechnet Ganzspalten-Bezuege wie "Feiertage!$B:$C" falsch (negative Spaltennummern).
// Gleichwertig und ausreichend: feste Zeilengrenze der Vorlage.
function ganzspaltenAufloesen(formel: string): string {
  return formel.replace(
    /(?<![A-Za-z0-9])(\$?[A-Z]{1,3}):(\$?[A-Z]{1,3})(?![A-Za-z0-9(])/g,
    (_m, a: string, b: string) => `${a}$1:${b}$${MAX_ZEILE_GANZE_SPALTE}`,
  );
}

// Excel rundet Zeitwerte vor HOUR/MINUTE auf die Sekunde. Ohne das ergibt z.B. 10:00 (als
// 0.41666666666666663 gespeichert) faelschlich 9 Stunden 59 Minuten.
function zeitInSekunden(arg: unknown): number {
  // Die Bibliothek reicht Argumente von Custom-Funktionen als { value, isArray, ... } durch.
  const x = typeof arg === "object" && arg !== null && "value" in arg ? (arg as { value: unknown }).value : arg;
  const n = typeof x === "number" ? x : Number(x);
  const bruchteil = ((n % 1) + 1) % 1;
  return Math.round(bruchteil * 86_400) % 86_400;
}

function spaltenNummer(buchstaben: string): number {
  let n = 0;
  for (const ch of buchstaben) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

interface Bezug {
  sheet: string;
  from: { row: number; col: number };
  to: { row: number; col: number };
}

function bezuegeAus(formel: string, aktuellesBlatt: string): Bezug[] {
  const ohneTexte = formel.replace(/"[^"]*"/g, '""');
  const re =
    /(?<![A-Za-z0-9_.])(?:(?:'([^']+)'|([A-Za-z_][A-Za-z0-9_]*))!)?\$?([A-Z]{1,3})\$?(\d+)(?::\$?([A-Z]{1,3})\$?(\d+))?(?![A-Za-z0-9(_])/g;
  const out: Bezug[] = [];
  for (const m of ohneTexte.matchAll(re)) {
    const sheet = m[1] ?? m[2] ?? aktuellesBlatt;
    const von = { row: Number(m[4]), col: spaltenNummer(m[3]!) };
    const bis = m[5] ? { row: Number(m[6]), col: spaltenNummer(m[5]) } : von;
    out.push({
      sheet,
      from: { row: Math.min(von.row, bis.row), col: Math.min(von.col, bis.col) },
      to: { row: Math.max(von.row, bis.row), col: Math.max(von.col, bis.col) },
    });
  }
  return out;
}

export interface FormelWerteErgebnis {
  anzahlFormeln: number;
  fehler: string[];
}

export function berechneFormelWerte(workbook: ExcelJS.Workbook): FormelWerteErgebnis {
  const fehler: string[] = [];
  const cache = new Map<string, Zellwert>();

  // Alle Formelzellen vorab indexieren (ohne verbundene Zellen, die haben keine eigene Formel).
  const formelFormeln = new Map<string, string>();
  const formelPositionenProBlatt = new Map<string, Position[]>();
  for (const ws of workbook.worksheets) {
    const liste: Position[] = [];
    ws.eachRow({ includeEmpty: false }, (row) =>
      row.eachCell({ includeEmpty: false }, (cell) => {
        if (cell.type !== ExcelJS.ValueType.Formula) return;
        const formel = cell.formula;
        if (!formel) return;
        const pos = { sheet: ws.name, row: cell.row as unknown as number, col: cell.col as unknown as number };
        formelFormeln.set(schluessel(pos), ganzspaltenAufloesen(formel));
        liste.push(pos);
      }),
    );
    formelPositionenProBlatt.set(ws.name, liste);
  }

  const literal = (pos: Position): Zellwert => {
    const cell = workbook.getWorksheet(pos.sheet)?.findCell(pos.row, pos.col);
    return cell ? literalWert(cell.value) : null;
  };

  const lesen = (pos: Position): Zellwert => {
    const key = schluessel(pos);
    if (formelFormeln.has(key)) return cache.get(key) ?? null;
    return literal(pos);
  };

  const parser = new FormulaParser({
    onCell: (ref) => lesen(ref),
    onRange: (ref) => {
      const ws = workbook.getWorksheet(ref.sheet);
      const letzteZeile = Math.min(ref.to.row, ws?.rowCount ?? ref.to.row);
      const zeilen: Zellwert[][] = [];
      for (let r = ref.from.row; r <= letzteZeile; r++) {
        const zeile: Zellwert[] = [];
        for (let c = ref.from.col; c <= ref.to.col; c++) zeile.push(lesen({ sheet: ref.sheet, row: r, col: c }));
        zeilen.push(zeile);
      }
      return zeilen;
    },
    functions: {
      HOUR: (x: unknown) => Math.floor(zeitInSekunden(x) / 3600),
      MINUTE: (x: unknown) => Math.floor((zeitInSekunden(x) % 3600) / 60),
    },
  });
  // Von welchen anderen FORMEL-Zellen haengt eine Zelle ab? (Literale muessen nicht abgewartet werden.)
  // Eigene Erkennung statt des mitgelieferten DepParsers: der verliert hinter VLOOKUP alle weiteren
  // Bezuege (z.B. Summen!B9 in der Soll-Formel), die Zelle wuerde dann zu frueh ausgewertet.
  const abhaengigkeiten = (pos: Position): string[] => {
    const formel = formelFormeln.get(schluessel(pos))!;
    const out = new Set<string>();
    for (const ref of bezuegeAus(formel, pos.sheet)) {
      if (ref.from.row === ref.to.row && ref.from.col === ref.to.col) {
        const key = schluessel({ sheet: ref.sheet, row: ref.from.row, col: ref.from.col });
        if (formelFormeln.has(key)) out.add(key);
        continue;
      }
      for (const p of formelPositionenProBlatt.get(ref.sheet) ?? []) {
        if (p.row >= ref.from.row && p.row <= ref.to.row && p.col >= ref.from.col && p.col <= ref.to.col) {
          out.add(schluessel(p));
        }
      }
    }
    return [...out];
  };

  const positionAusSchluessel = (key: string): Position => {
    const [sheet, rest] = key.split("!") as [string, string];
    const [row, col] = rest.split(",").map(Number) as [number, number];
    return { sheet, row, col };
  };

  const auswerten = (startKey: string) => {
    const pfad: string[] = [startKey];
    const imPfad = new Set<string>([startKey]);
    const abhCache = new Map<string, string[]>();

    while (pfad.length > 0) {
      const key = pfad[pfad.length - 1]!;
      if (cache.has(key)) {
        pfad.pop();
        imPfad.delete(key);
        continue;
      }
      const pos = positionAusSchluessel(key);
      let abh = abhCache.get(key);
      if (!abh) {
        abh = abhaengigkeiten(pos);
        abhCache.set(key, abh);
      }
      const offen = abh.find((k) => !cache.has(k) && !imPfad.has(k));
      if (offen) {
        pfad.push(offen);
        imPfad.add(offen);
        continue;
      }
      // Zirkelbezuege (offene Abhaengigkeit steckt schon im Pfad) werden als 0 behandelt.
      if (abh.some((k) => !cache.has(k))) fehler.push(`Zirkelbezug bei ${key}`);

      try {
        const roh = parser.parse(formelFormeln.get(key)!, pos);
        const einzel = Array.isArray(roh) ? (Array.isArray(roh[0]) ? roh[0][0] : roh[0]) : roh;
        cache.set(key, einzel instanceof Date ? alsSeriennummer(einzel) : ((einzel ?? null) as Zellwert));
      } catch (e) {
        fehler.push(`${key} (${formelFormeln.get(key)}): ${e instanceof Error ? e.message : String(e)}`);
        cache.set(key, null);
      }
      pfad.pop();
      imPfad.delete(key);
    }
  };

  for (const key of formelFormeln.keys()) {
    if (!cache.has(key)) auswerten(key);
  }

  // Ergebnisse als mitgespeicherte Werte zurueckschreiben.
  for (const ws of workbook.worksheets) {
    for (const pos of formelPositionenProBlatt.get(ws.name) ?? []) {
      const cell = ws.getCell(pos.row, pos.col);
      const v = cell.value as unknown as Record<string, unknown>;
      const ergebnis = cache.get(schluessel(pos)) ?? null;
      const result =
        ergebnis instanceof FormulaError
          ? { error: ergebnis.error as ExcelJS.CellErrorValue["error"] }
          : (ergebnis ?? 0); // Excel zeigt den Bezug auf eine leere Zelle als 0
      cell.value = { ...v, result } as ExcelJS.CellValue;
    }
  }

  return { anzahlFormeln: formelFormeln.size, fehler };
}
