import { prisma } from "@/lib/db";
import {
  berechneTagesReihe,
  sollProTagFuerDatum,
  type DailyEntryInput,
  type Feiertag,
  type PensumPeriode,
  type StempelPaar,
} from "@/lib/calc";

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function alleTageImJahr(jahr: number): string[] {
  const tage: string[] = [];
  const cursor = new Date(Date.UTC(jahr, 0, 1));
  while (cursor.getUTCFullYear() === jahr) {
    tage.push(iso(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return tage;
}

export interface MonatsStand {
  standVorMonat: number;
  standEndeMonat: number;
}

export interface MonatsStandOptionen {
  /**
   * Für Tage NACH heute wird Soll und Ist beide auf 0 gesetzt (= "als hätte man die geforderten
   * 100% erledigt"), statt wie im echten Rapport eine Soll-Zeit ohne Gegenbuchung anzuhäufen.
   * Ohne diese Option würde der Gleitzeitstand für den laufenden Monat immer stark negativ
   * aussehen, einfach weil die restlichen Kalendertage noch gar nicht erfasst werden konnten, das
   * sagt nichts darüber aus, ob die Person tatsächlich im Rückstand ist. Nur für die
   * Chef-Übersicht gedacht (schneller Blick "wo stehen wir heute"), NICHT für den echten,
   * rollierenden Saldo auf der persönlichen Monatsseite oder den Excel-Export, die bleiben exakt
   * wie im Original-Rapport (zukünftige Tage zählen dort bewusst als offen/negativ, bis sie
   * erfasst sind).
   */
  nichtInDieZukunftProjizieren?: boolean;
}

// Reduzierte Variante derselben Stand-Berechnung wie in
// mitarbeiter/[userId]/[jahr]/[monat]/page.tsx, nur auf die beiden Stand-Werte statt der ganzen
// Tagesansicht (fuer die Chef-Uebersicht, wo pro Mitarbeitendem nur die Gleitzeit interessiert,
// nicht die einzelnen Tage). Bewusst als eigene, kleinere Funktion statt die Seite selbst
// umzubauen, um deren gut getestetes Verhalten fuer die Kernansicht nicht anzufassen.
export async function berechneMonatsStand(
  userId: string,
  jahr: number,
  monat: number,
  optionen: MonatsStandOptionen = {},
): Promise<MonatsStand | null> {
  const [jahresStammdaten, user] = await Promise.all([
    prisma.jahresStammdaten.findUnique({ where: { userId_year: { userId, year: jahr } } }),
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
  ]);

  if (!jahresStammdaten) return null;

  const [feiertageDb, entriesDb, pensumWechselDb] = await Promise.all([
    prisma.holiday.findMany({
      where: {
        companyId: user.companyId,
        date: { gte: new Date(Date.UTC(jahr, 0, 1)), lt: new Date(Date.UTC(jahr + 1, 0, 1)) },
      },
    }),
    prisma.dailyEntry.findMany({
      where: {
        userId,
        date: { gte: new Date(Date.UTC(jahr, 0, 1)), lt: new Date(Date.UTC(jahr + 1, 0, 1)) },
      },
      include: { bookings: true },
    }),
    prisma.pensumWechsel.findMany({ where: { userId }, orderBy: { gueltigAb: "asc" } }),
  ]);

  const feiertage: Feiertag[] = feiertageDb.map((h) => ({
    date: iso(h.date),
    label: h.label,
    bezahlt: h.bezahlt,
  }));

  const entriesByDate = new Map(entriesDb.map((e) => [iso(e.date), e]));

  const pensumBasis = { anstellungPct: jahresStammdaten.anstellungPct, wochenstunden: jahresStammdaten.wochenstunden };
  const pensumWechsel: PensumPeriode[] = pensumWechselDb.map((w) => ({
    gueltigAb: iso(w.gueltigAb),
    anstellungPct: w.anstellungPct,
    wochenstunden: w.wochenstunden,
  }));
  const sollProTagWertFuerDatum = (date: string) => sollProTagFuerDatum(date, pensumBasis, pensumWechsel);

  const startDatumIso = jahresStammdaten.erfassungStartDatum
    ? iso(jahresStammdaten.erfassungStartDatum)
    : null;
  const heuteIso = iso(new Date());

  const alleTage = alleTageImJahr(jahr);
  const entryInputs: DailyEntryInput[] = alleTage.map((date) => {
    const e = entriesByDate.get(date);
    const vorStart = startDatumIso !== null && date < startDatumIso;
    // Siehe MonatsStandOptionen.nichtInDieZukunftProjizieren: Tage nach heute zaehlen dann weder
    // als Soll noch als Ist, sie beeinflussen den Stand also gar nicht erst.
    const inDerZukunft = optionen.nichtInDieZukunftProjizieren === true && date > heuteIso;
    if (!e || inDerZukunft) {
      const leer: StempelPaar = { start: null, stop: null };
      return {
        date,
        projektStunden: 0,
        krank: 0,
        reisezeit: 0,
        cad: 0,
        ausbildung: 0,
        buero: 0,
        ferien: 0,
        sollOverride: inDerZukunft ? 0 : vorStart ? 0 : null,
        stempelzeiten: [leer, leer, leer, leer],
      };
    }
    return {
      date,
      projektStunden: e.bookings.reduce((sum, b) => sum + b.hours, 0),
      krank: e.krank,
      reisezeit: e.reisezeit,
      cad: e.cad,
      ausbildung: e.ausbildung,
      buero: e.buero,
      ferien: e.ferien,
      sollOverride: vorStart ? 0 : e.sollOverride,
      stempelzeiten: [
        { start: e.start1, stop: e.stop1 },
        { start: e.start2, stop: e.stop2 },
        { start: e.start3, stop: e.stop3 },
        { start: e.start4, stop: e.stop4 },
      ],
    };
  });

  const ergebnisse = berechneTagesReihe(
    entryInputs,
    sollProTagWertFuerDatum,
    feiertage,
    jahresStammdaten.stundenuebertragAltesJahr,
  );

  const monatPraefix = `${jahr}-${String(monat).padStart(2, "0")}`;
  const monatStartIdx = ergebnisse.findIndex((e) => e.date.startsWith(monatPraefix));
  const monatErgebnisse = ergebnisse.filter((e) => e.date.startsWith(monatPraefix));
  const standVorMonat =
    monatStartIdx > 0 ? ergebnisse[monatStartIdx - 1]!.stand : jahresStammdaten.stundenuebertragAltesJahr;
  const standEndeMonat = monatErgebnisse[monatErgebnisse.length - 1]?.stand ?? standVorMonat;

  return { standVorMonat, standEndeMonat };
}
