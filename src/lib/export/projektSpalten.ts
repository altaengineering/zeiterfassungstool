import type { ExportProjekt } from "./exportExcel";

// Die Excel-Vorlage hat nur 9 Projekt-Spalten (C-K). Das Ist (Spalte S) ist dort die Summe ALLER
// Spalten C-Q, in der App die Summe ALLER Buchungen. Damit beide gleich bleiben, darf keine Buchung
// beim Export "durchs Raster fallen". Frueher bekamen nur aktive Projekte eine Spalte und pro Tag
// und Projekt wurde nur die erste Buchung uebernommen: Buchungen auf inzwischen deaktivierte oder
// geloeschte Projekte (Label ohne Projekt-Verknuepfung), auf umbenannte Projekte und mehr als 9
// Projekte fehlten im Excel, Ist, Plus/Minus und Gleitzeit-Stand waren dadurch zu niedrig.

export const SAMMEL_SPALTE_ID = "__weitere__";
export const SAMMEL_SPALTE_NAME = "Weitere Projekte";

export interface ProjektQuelle {
  id: string;
  name: string;
  aktiv: boolean;
}

export interface BuchungKurz {
  projectId: string | null;
  label: string;
  hours: number;
}

export interface ProjektSpalten {
  spalten: ExportProjekt[];
  /** Id der Spalte, in die diese Buchung gehoert (immer eine der `spalten`). */
  spaltenIdFuer: (buchung: Pick<BuchungKurz, "projectId" | "label">) => string;
}

export function ordneProjektSpalten(
  projekte: readonly ProjektQuelle[],
  buchungen: readonly BuchungKurz[],
  maxSpalten = 9,
): ProjektSpalten {
  const byId = new Map(projekte.map((p) => [p.id, p]));

  // Kandidaten: erst alle aktiven Projekte in ihrer festen Reihenfolge, dann alles, was Buchungen hat.
  const kandidaten: ExportProjekt[] = projekte.filter((p) => p.aktiv).map((p) => ({ id: p.id, name: p.name }));
  const stunden = new Map<string, number>();

  const schluesselFuer = (b: Pick<BuchungKurz, "projectId" | "label">): string => {
    if (b.projectId && byId.has(b.projectId)) return b.projectId;
    const nachName = kandidaten.find((k) => k.name === b.label);
    return nachName ? nachName.id : `label:${b.label}`;
  };

  for (const b of buchungen) {
    const key = schluesselFuer(b);
    if (!kandidaten.some((k) => k.id === key)) {
      const name = b.projectId && byId.has(b.projectId) ? byId.get(b.projectId)!.name : b.label;
      kandidaten.push({ id: key, name });
    }
    stunden.set(key, (stunden.get(key) ?? 0) + b.hours);
  }

  let spalten = kandidaten;
  let inSammelSpalte = new Set<string>();

  if (spalten.length > maxSpalten) {
    // Zuerst Spalten ohne Stunden weglassen, die kosten nur Platz.
    spalten = spalten.filter((k) => (stunden.get(k.id) ?? 0) !== 0);
  }
  if (spalten.length > maxSpalten) {
    const behalten = spalten.slice(0, maxSpalten - 1);
    inSammelSpalte = new Set(spalten.slice(maxSpalten - 1).map((k) => k.id));
    spalten = [...behalten, { id: SAMMEL_SPALTE_ID, name: SAMMEL_SPALTE_NAME }];
  }

  const sichtbar = new Set(spalten.map((s) => s.id));
  const spaltenIdFuer: ProjektSpalten["spaltenIdFuer"] = (b) => {
    const key = schluesselFuer(b);
    if (sichtbar.has(key) && !inSammelSpalte.has(key)) return key;
    return spalten.some((s) => s.id === SAMMEL_SPALTE_ID) ? SAMMEL_SPALTE_ID : (spalten[spalten.length - 1]?.id ?? key);
  };

  return { spalten, spaltenIdFuer };
}
