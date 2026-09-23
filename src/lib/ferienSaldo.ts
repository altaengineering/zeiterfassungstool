import { prisma } from "@/lib/db";
import {
  berechneFerienBezogen,
  berechneFerienBezogenGesamt,
  berechneFerienGuthaben,
  berechneFerienuebertragNaechstesJahr,
  sollProTag,
  STANDARD_JAHRESFERIENTAGE,
} from "@/lib/calc";

export { berechneUebertragAusAktuellemSaldo } from "@/lib/calc";

export interface FerienSaldo {
  /** Ferien, die die Person dieses Jahr insgesamt bekommt (Übertrag + anteiliger Jahresanspruch). */
  ferienGuthaben: number;
  /** Bereits bezogene Ferientage (echte Kalender-Einträge + manuelle Korrektur). */
  ferienBezogen: number;
  /** Was noch übrig ist (Guthaben - bezogen). */
  ferienUebertrag: number;
}

// Gemeinsame Berechnung, urspruenglich nur auf der Einrichtungsseite (src/app/konto/einrichtung),
// jetzt zusaetzlich fuer /ferien (eigener Saldo beim Beantragen) und die Chef-Uebersicht
// (Saldo-Spalte pro Mitarbeitendem) gebraucht — als eigene Funktion statt dreifach kopiert.
export async function berechneFerienSaldo(userId: string, jahr: number): Promise<FerienSaldo | null> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const [stammdaten, companySettings, entriesDb] = await Promise.all([
    prisma.jahresStammdaten.findUnique({ where: { userId_year: { userId, year: jahr } } }),
    prisma.companySettings.findUnique({
      where: { companyId_year: { companyId: user.companyId, year: jahr } },
    }),
    prisma.dailyEntry.findMany({
      where: { userId, date: { gte: new Date(Date.UTC(jahr, 0, 1)), lt: new Date(Date.UTC(jahr + 1, 0, 1)) } },
    }),
  ]);
  if (!stammdaten) return null;

  const standardJahresferientage = companySettings?.jahresferientage ?? STANDARD_JAHRESFERIENTAGE;
  const jahresferientageEffektiv = stammdaten.jahresferientage ?? standardJahresferientage;
  const ferienGuthaben = berechneFerienGuthaben(
    stammdaten.ferienuebertragAltesJahr,
    stammdaten.arbeitsmonate,
    jahresferientageEffektiv,
  );
  const ferienStundenProMonat = Array.from({ length: 12 }, (_, m) =>
    entriesDb.filter((e) => e.date.getUTCMonth() === m).reduce((sum, e) => sum + e.ferien, 0),
  );
  const sollProTagWert = sollProTag(stammdaten.wochenstunden, stammdaten.anstellungPct);
  const ferienBezogen = berechneFerienBezogenGesamt(
    berechneFerienBezogen(ferienStundenProMonat, sollProTagWert),
    stammdaten.ferienBezogenKorrektur,
  );
  const ferienUebertrag = berechneFerienuebertragNaechstesJahr(ferienGuthaben, ferienBezogen);

  return { ferienGuthaben, ferienBezogen, ferienUebertrag };
}
