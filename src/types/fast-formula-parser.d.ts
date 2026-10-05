// Das Paket liefert keine eigenen Typen mit. Nur die kleine Teilmenge, die src/lib/export/formelWerte.ts nutzt.
declare module "fast-formula-parser" {
  interface CellRef {
    sheet: string;
    row: number;
    col: number;
  }
  interface RangeRef {
    sheet: string;
    from: { row: number; col: number };
    to: { row: number; col: number };
  }
  interface ParserConfig {
    onCell: (ref: CellRef) => unknown;
    onRange: (ref: RangeRef) => unknown;
    functions?: Record<string, (...args: unknown[]) => unknown>;
  }

  class FormulaError extends Error {
    error: string;
  }

  export default class FormulaParser {
    constructor(config: ParserConfig);
    parse(formula: string, position: CellRef): unknown;
    static FormulaError: typeof FormulaError;
  }
}
