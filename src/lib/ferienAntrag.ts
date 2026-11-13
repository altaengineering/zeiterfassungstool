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
 * Bei Genehmigung eines "ferien"-Antrags werden fuer jeden Arbeitstag im Zeitraum DailyEntry-
 * Zeilen mit ferien=Soll-pro-Tag angelegt bzw. aktualisiert (nur das ferien-Feld, andere Buchungen
 * an diesem Tag bleiben unberuehrt) — sonst haette ein "genehmigter" Antrag keinerlei Effekt auf
 * den echten Ferien-Saldo, der ausschliesslich aus echten Tageseintraegen berechnet wird (siehe
 * src/lib/calc/ferien.ts). Ein "gleitzeit"-Antrag braucht das nicht: ein Arbeitstag ohne jede
 * Buchung senkt den Gleitzeit-Stand bereits von selbst (Ist 0 gegen normales Soll), es wird nur
 * eine leere DailyEntry-Zeile angelegt (fehlende Zeile wuerde die Chef-Uebersicht faelschlich als
 * "nicht erfasst" zeigen) plus eine oeffentliche KalenderNotiz, damit im Firmenkalender sichtbar
 * ist, warum die Person an diesem Tag fehlt. Zeitraum kann eine Jahresgrenze ueberschreiten, daher
 * werden die Jahres-Stammdaten (fuer den Soll-pro-Tag-Basiswert) pro betroffenem Jahr separat
 * geladen.
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
    const tage = await arbeitstageFuerZeitraum(user.companyId, vonIso, bisIso);

    if (antrag.typ === "gleitzeit") {
      for (const datum of tage) {
        const vorhanden = await prisma.dailyEntry.findUnique({
          where: { userId_date: { userId: antrag.userId, date: parseISODate(datum) } },
        });
        if (!vorhanden) {
          await prisma.dailyEntry.create({ data: { userId: antrag.userId, date: parseISODate(datum) } });
        }
      }
      await prisma.kalenderNotiz.createMany({
        data: tage.map((datum) => ({
          userId: antrag.userId,
          date: parseISODate(datum),
          text: "Gleitzeit-Abwesenheit (genehmigt)",
          oeffentlich: true,
        })),
      });
    } else {
      const [pensumWechselDb, jahresStammdatenDb] = await Promise.all([
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
        // Kein Jahres-Stammdatensatz fuer dieses Jahr (z.B. Person erst spaeter eingetreten) ->
        // kann fuer diesen Tag keinen sinnvollen Soll-Wert ermitteln, Tag wird uebersprungen statt
        // mit einem geratenen Wert befuellt.
        if (!basis) continue;
        const sollProTagWert = sollProTagFuerDatum(datum, basis, pensumWechsel);
        await prisma.dailyEntry.upsert({
          where: { userId_date: { userId: antrag.userId, date: parseISODate(datum) } },
          create: { userId: antrag.userId, date: parseISODate(datum), ferien: sollProTagWert },
          update: { ferien: sollProTagWert },
        });
      }
    }
  }

  await prisma.ferienAntrag.update({
    where: { id: antragId },
    data: { status: entscheidung, entschiedenAm: new Date(), entschiedenVon: adminEmail },
  });

  return {};
}

const GLEITZEIT_NOTIZ = "Gleitzeit-Abwesenheit (genehmigt)";

/** Loescht einen Tageseintrag, wenn er nach dem Stornieren komplett leer ist (keine Stunden, Buchungen, Spesen, Stempelzeiten). */
async function leerenEintragEntfernen(userId: string, datum: ISODate): Promise<void> {
  const e = await prisma.dailyEntry.findUnique({
    where: { userId_date: { userId, date: parseISODate(datum) } },
    include: { bookings: true },
  });
  if (!e) return;
  const leer =
    e.bookings.length === 0 &&
    e.krank === 0 && e.reisezeit === 0 && e.cad === 0 && e.ausbildung === 0 && e.buero === 0 &&
    e.ferien === 0 && e.spesenFr === 0 && e.km === 0 &&
    e.sollOverride === null &&
    e.start1 === null && e.stop1 === null && e.start2 === null && e.stop2 === null &&
    e.start3 === null && e.stop3 === null && e.start4 === null && e.stop4 === null;
  if (leer) await prisma.dailyEntry.delete({ where: { id: e.id } });
}

function tagVorher(d: ISODate): ISODate {
  return iso(new Date(parseISODate(d).getTime() - 86400000));
}
function tagNachher(d: ISODate): ISODate {
  return iso(new Date(parseISODate(d).getTime() + 86400000));
}

/**
 * Storniert einen bereits GENEHMIGTEN Abwesenheitsantrag ganz oder nur fuer einen Teil-Zeitraum
 * (z.B. 2 von 3 Gleitzeit-Tagen). Macht die Wirkung der Genehmigung rueckgaengig:
 *  - "ferien": ferien-Stunden der betroffenen Arbeitstage zurueck auf 0 (uebrige Buchungen bleiben);
 *  - "gleitzeit": die in der Genehmigung angelegten leeren Tageszeilen und die oeffentliche
 *    Kalender-Notiz entfernen (gearbeitete Stunden an diesen Tagen bleiben erhalten).
 * Der Antrag selbst wird auf "storniert" gesetzt bzw. auf den verbleibenden Zeitraum gekuerzt
 * (liegt ein Rest vor UND nach dem Storno-Zeitraum, entsteht fuer den hinteren Rest ein neuer
 * genehmigter Antrag). Berechtigung/Monatsabschluss prueft der Aufrufer.
 */
export async function ferienAntragStornieren(
  antragId: string,
  stornoVon: ISODate,
  stornoBis: ISODate,
): Promise<{ error?: string; tage?: number }> {
  const antrag = await prisma.ferienAntrag.findUnique({ where: { id: antragId } });
  if (!antrag) return { error: "Antrag nicht gefunden." };
  if (antrag.status !== "genehmigt") return { error: "Nur genehmigte Anträge können storniert werden." };

  const antragVon = iso(antrag.von);
  const antragBis = iso(antrag.bis);
  const von = stornoVon > antragVon ? stornoVon : antragVon;
  const bis = stornoBis < antragBis ? stornoBis : antragBis;
  if (von > bis) return { error: "Der gewählte Zeitraum liegt ausserhalb des Antrags." };

  const user = await prisma.user.findUniqueOrThrow({ where: { id: antrag.userId } });
  const tage = await arbeitstageFuerZeitraum(user.companyId, von, bis);

  if (antrag.typ === "gleitzeit") {
    await prisma.kalenderNotiz.deleteMany({
      where: {
        userId: antrag.userId,
        text: GLEITZEIT_NOTIZ,
        date: { gte: parseISODate(von), lte: parseISODate(bis) },
      },
    });
    for (const datum of tage) await leerenEintragEntfernen(antrag.userId, datum);
  } else {
    for (const datum of tage) {
      await prisma.dailyEntry.updateMany({
        where: { userId: antrag.userId, date: parseISODate(datum) },
        data: { ferien: 0 },
      });
      await leerenEintragEntfernen(antrag.userId, datum);
    }
  }

  // Verbleibende Teile des urspruenglichen Antrags (vor bzw. nach dem stornierten Zeitraum).
  const teile: { von: ISODate; bis: ISODate; arbeitstage: number }[] = [];
  if (antragVon < von) {
    const t = await arbeitstageFuerZeitraum(user.companyId, antragVon, tagVorher(von));
    if (t.length > 0) teile.push({ von: antragVon, bis: tagVorher(von), arbeitstage: t.length });
  }
  if (bis < antragBis) {
    const t = await arbeitstageFuerZeitraum(user.companyId, tagNachher(bis), antragBis);
    if (t.length > 0) teile.push({ von: tagNachher(bis), bis: antragBis, arbeitstage: t.length });
  }

  const [erster, zweiter] = teile;
  if (!erster) {
    await prisma.ferienAntrag.update({ where: { id: antrag.id }, data: { status: "storniert" } });
  } else {
    await prisma.ferienAntrag.update({
      where: { id: antrag.id },
      data: { von: parseISODate(erster.von), bis: parseISODate(erster.bis), arbeitstage: erster.arbeitstage },
    });
    if (zweiter) {
      await prisma.ferienAntrag.create({
        data: {
          userId: antrag.userId,
          von: parseISODate(zweiter.von),
          bis: parseISODate(zweiter.bis),
          arbeitstage: zweiter.arbeitstage,
          typ: antrag.typ,
          kommentar: antrag.kommentar,
          status: "genehmigt",
          entschiedenAm: antrag.entschiedenAm,
          entschiedenVon: antrag.entschiedenVon,
        },
      });
    }
  }

  return { tage: tage.length };
}
