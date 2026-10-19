import { prisma } from "@/lib/db";
import { berechneMonatsStand } from "@/lib/monatsStand";
import { berechneFerienSaldo } from "@/lib/ferienSaldo";
import { feiertagFuerJahr, pensumFuerDatum, type PensumPeriode } from "@/lib/calc";

// Jahreswechsel: Für jedes Jahr braucht jede Person eine Zeile JahresStammdaten (Pensum, Übertrag aus dem
// Vorjahr, Ferienanspruch). Sie entstand früher nur beim Anlegen einer Person, im neuen Jahr fehlte sie
// dann und die Monatsansicht blieb leer. Diese Datei berechnet die Übernahme aus dem Vorjahr und legt die
// Zeile an: von der Admin-Seite aus (/admin/jahreswechsel) und als Sicherheitsnetz automatisch, sobald im
// laufenden Jahr jemand ohne Jahresdaten die Seite öffnet.

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function runde(wert: number): number {
  return Math.round(wert * 10000) / 10000;
}

export interface Uebernahme {
  anstellungPct: number;
  wochenstunden: number;
  /** Gleitzeit-Stand am 31.12. des Vorjahres. */
  stundenuebertrag: number;
  /** Ferientage, die vom Vorjahr übrig sind (kann negativ sein). */
  ferienuebertrag: number;
  /** Persönlicher Ferienanspruch aus dem Vorjahr, null = Standard der Firma. */
  jahresferientage: number | null;
}

/** Was aus dem Vorjahr (`vonJahr`) ins Folgejahr übernommen wird, oder null, wenn es das Vorjahr nicht gibt. */
export async function berechneUebernahme(userId: string, vonJahr: number): Promise<Uebernahme | null> {
  const stamm = await prisma.jahresStammdaten.findUnique({ where: { userId_year: { userId, year: vonJahr } } });
  if (!stamm) return null;

  const wechselDb = await prisma.pensumWechsel.findMany({ where: { userId }, orderBy: { gueltigAb: "asc" } });
  const wechsel: PensumPeriode[] = wechselDb.map((w) => ({
    gueltigAb: iso(w.gueltigAb),
    anstellungPct: w.anstellungPct,
    wochenstunden: w.wochenstunden,
  }));
  // Das Pensum, das am Jahresende galt, gilt zum Jahresanfang weiter.
  const pensum = pensumFuerDatum(`${vonJahr}-12-31`, { anstellungPct: stamm.anstellungPct, wochenstunden: stamm.wochenstunden }, wechsel);
  const stand = await berechneMonatsStand(userId, vonJahr, 12);
  const ferien = await berechneFerienSaldo(userId, vonJahr);

  return {
    anstellungPct: pensum.anstellungPct,
    wochenstunden: pensum.wochenstunden,
    stundenuebertrag: runde(stand?.standEndeMonat ?? 0),
    ferienuebertrag: runde(ferien?.ferienUebertrag ?? 0),
    jahresferientage: stamm.jahresferientage,
  };
}

/**
 * Stellt sicher, dass es JahresStammdaten für (Person, Jahr) gibt. Fehlen sie, werden sie aus dem Vorjahr
 * übernommen. Für Jahre in der Zukunft passiert nichts, ebenso wenn es kein Vorjahr gibt.
 */
export async function stelleStammdatenSicher(userId: string, jahr: number) {
  const vorhanden = await prisma.jahresStammdaten.findUnique({ where: { userId_year: { userId, year: jahr } } });
  if (vorhanden) return vorhanden;
  if (jahr > new Date().getUTCFullYear()) return null;

  const u = await berechneUebernahme(userId, jahr - 1);
  if (!u) return null;
  try {
    return await prisma.jahresStammdaten.create({
      data: {
        userId,
        year: jahr,
        anstellungPct: u.anstellungPct,
        wochenstunden: u.wochenstunden,
        anzahlVorholtage: 0,
        stundenuebertragAltesJahr: u.stundenuebertrag,
        ferienuebertragAltesJahr: u.ferienuebertrag,
        arbeitsmonate: 12,
        jahresferientage: u.jahresferientage,
        ferienBezogenKorrektur: 0,
        // Erfassung gilt ab Jahresbeginn: kein Einrichtungs-Banner, kein erzwungenes Soll 0.
        erfassungStartDatum: new Date(Date.UTC(jahr, 0, 1)),
        ferienEinrichtungErledigt: true,
      },
    });
  } catch (e) {
    // Zwei gleichzeitige Aufrufe: die Zeile existiert dann bereits.
    if ((e as { code?: string }).code === "P2002") {
      return prisma.jahresStammdaten.findUnique({ where: { userId_year: { userId, year: jahr } } });
    }
    throw e;
  }
}

export interface FeiertagVorschlag {
  date: string;
  label: string;
  bezahlt: boolean;
}

/** Feiertage des Vorjahres, umgerechnet auf `jahr`, die es im Zieljahr noch nicht gibt. */
export async function feiertageVorschlag(companyId: string, jahr: number): Promise<FeiertagVorschlag[]> {
  const [alt, neu] = await Promise.all([
    prisma.holiday.findMany({
      where: { companyId, date: { gte: new Date(Date.UTC(jahr - 1, 0, 1)), lt: new Date(Date.UTC(jahr, 0, 1)) } },
      orderBy: { date: "asc" },
    }),
    prisma.holiday.findMany({
      where: { companyId, date: { gte: new Date(Date.UTC(jahr, 0, 1)), lt: new Date(Date.UTC(jahr + 1, 0, 1)) } },
    }),
  ]);
  const vorhandeneDaten = new Set(neu.map((h) => iso(h.date)));
  const vorhandeneNamen = new Set(neu.map((h) => h.label.trim().toLowerCase()));
  const out: FeiertagVorschlag[] = [];
  for (const h of alt) {
    const label = h.label.trim();
    if (vorhandeneNamen.has(label.toLowerCase())) continue;
    const date = feiertagFuerJahr(label, iso(h.date), jahr);
    if (vorhandeneDaten.has(date)) continue;
    out.push({ date, label, bezahlt: h.bezahlt });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
