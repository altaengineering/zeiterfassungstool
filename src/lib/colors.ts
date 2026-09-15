// Deterministische, kleine Farbpalette für Namens-/Projekt-Badges: derselbe Text bekommt in der
// ganzen App immer dieselbe Farbe (Kalender-Chip, Chef-Übersicht-Avatar, Projekt-Tag, ...), ohne
// dass irgendwo eine feste Zuordnungstabelle gepflegt werden müsste.
const PALETTENGROESSE = 6;

export function paletteIndex(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash % PALETTENGROESSE;
}

export function initialen(name: string): string {
  return name
    .split(/\s+/)
    .map((teil) => teil[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
