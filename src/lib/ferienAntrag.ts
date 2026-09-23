import { prisma } from "@/lib/db";
import {
  arbeitstageImZeitraum,
  parseISODate,
  sollProTagFuerDatum,
  type ISODate,
  type PensumPeriode,
} from "@/lib/calc";

function iso(date: Date): ISODate {
  return date.toISOString().slice(0, 10);
}

/** Arbeitstage (Mo-Fr, ohne bezahlte Feiertage der Firma) im Zeitraum [von, bis] eines Antrags. */
export async function arbeitstageFuerZeitraum(
  companyId: string,
  von: ISODate,
  bis: ISODate,
): Promise<ISODate[]> {
  const feiertageDb = await prisma.holiday.findMany({
    where: { companyId, date: { gte: parseISODate(von), lte: parseISODate(bis) }, bezahlt: true },
  });
  const feiertage = new Set(feiertageDb.map((f) => iso(f.date)));
  return arbeitstageImZeitraum(von, bis, feiertage);
}

/**
 * Bei Genehmigung werden fuer jeden Arbeitstag im Zeitraum DailyEntry-Zeilen mit
 * ferien=Soll-pro-Tag angelegt bzw. aktualisiert (nur das ferien-Feld, andere Buchungen an
 * diesem Tag bleiben unberuehrt) — sonst haette ein "genehmigter" Antrag keinerlei Effekt auf den
 * echten Ferien-Saldo, der ausschliesslich aus echten Tageseintraegen berechnet wird (siehe
 * src/lib/calc/ferien.ts). Zeitraum kann eine Jahresgrenze ueberschreiten, daher werden die
 * Jahres-Stammdaten (fuer den Soll-pro-Tag-Basiswert) pro betroffenem Jahr separat geladen.
 */
export async function ferienAntragEntscheiden(
  antragId: string,
  entscheidung: "genehmigt" | "abgelehnt",
  adminEmail: string,
): Promise<{ error?: string }> {
  const antrag = await prisma.ferienAntrag.findUnique({ where: { id: antragId } });
  if (!antrag) return { error: "Antrag nicht gefunden." };
  if (antrag.status !== "offen") return { error: "Antrag wurde bereits entschieden." };

  if (entscheidung === "genehmigt") {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: antrag.userId } });
    const vonIso = iso(antrag.von);
    const bisIso = iso(antrag.bis);

    const [tage, pensumWechselDb, jahresStammdatenDb] = await Promise.all([
      arbeitstageFuerZeitraum(user.companyId, vonIso, bisIso),
      prisma.pensumWechsel.findMany({ where: { userId: antrag.userId }, orderBy: { gueltigAb: "asc" } }),
      prisma.jahresStammdaten.findMany({ where: { userId: antrag.userId } }),
    ]);

    const stammdatenByYear = new Map(jahresStammdatenDb.map((s) => [s.year, s]));
    const pensumWechsel: PensumPeriode[] = pensumWechselDb.map((w) => ({
      gueltigAb: iso(w.gueltigAb),
      anstellungPct: w.anstellungPct,
      wochenstunden: w.wochenstunden,
    }));

    for (const datum of tage) {
      const jahr = Number(datum.slice(0, 4));
      const basis = stammdatenByYear.get(jahr);
      // Kein Jahres-Stammdatensatz fuer dieses Jahr (z.B. Person erst spaeter eingetreten) -> kann
      // fuer diesen Tag keinen sinnvollen Soll-Wert ermitteln, Tag wird uebersprungen statt mit
      // einem geratenen Wert befuellt.
      if (!basis) continue;
      const sollProTagWert = sollProTagFuerDatum(datum, basis, pensumWechsel);
      await prisma.dailyEntry.upsert({
        where: { userId_date: { userId: antrag.userId, date: parseISODate(datum) } },
        create: { userId: antrag.userId, date: parseISODate(datum), ferien: sollProTagWert },
        update: { ferien: sollProTagWert },
      });
    }
  }

  await prisma.ferienAntrag.update({
    where: { id: antragId },
    data: { status: entscheidung, entschiedenAm: new Date(), entschiedenVon: adminEmail },
  });

  return {};
}
