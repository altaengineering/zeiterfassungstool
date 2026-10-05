"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { sendeKrankmeldung } from "@/lib/email";

function minuten(formData: FormData, feld: string): number | null {
  const zeit = formData.get(feld);
  if (typeof zeit !== "string" || zeit === "") return null;
  const [h, m] = zeit.split(":").map(Number);
  if (h === undefined || m === undefined || Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function zahl(formData: FormData, feld: string): number {
  const wert = formData.get(feld);
  const n = typeof wert === "string" ? Number(wert) : 0;
  return Number.isFinite(n) ? n : 0;
}

export type SpeicherErgebnis = { ok: true } | { ok: false; fehler: string };

// Kurzzeitige Datenbankfehler (Verbindungs-Pool voll, Zeitueberschreitung, gleichzeitiger Doppelklick
// beim Upsert -> Unique-Verletzung) einmal bis dreimal wiederholen statt dem Nutzer sofort eine
// Fehlermeldung zu zeigen. Alles andere (z.B. Berechtigung) wird nicht wiederholt.
const WIEDERHOLBAR = new Set(["P2002", "P2034", "P2024", "P1001", "P1002", "P1008", "P1017"]);
async function mitWiederholung<T>(fn: () => Promise<T>, versuche = 3): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (!code || !WIEDERHOLBAR.has(code) || i >= versuche) throw e;
      await new Promise((r) => setTimeout(r, 150 * i));
    }
  }
}

class NutzerFehler extends Error {}

// Erwartete Fehler (Berechtigung, abgeschlossener Monat) als Rueckgabewert statt als geworfene
// Exception: Next.js ersetzt die Nachricht geworfener Fehler in Server Actions in der Produktion
// durch einen generischen Text, der Nutzer sah dadurch nie den echten Grund.
export async function tageseintragSpeichern(formData: FormData): Promise<SpeicherErgebnis> {
  try {
    await tageseintragSpeichernIntern(formData);
    return { ok: true };
  } catch (e) {
    if (e instanceof NutzerFehler) return { ok: false, fehler: e.message };
    console.error("tageseintragSpeichern fehlgeschlagen:", e);
    return { ok: false, fehler: "Speichern hat nicht geklappt. Bitte gleich nochmal auf Speichern klicken. Bleibt es dabei, kurz melden." };
  }
}

async function tageseintragSpeichernIntern(formData: FormData) {
  const userId = String(formData.get("userId"));
  const jahr = String(formData.get("jahr"));
  const monat = String(formData.get("monat"));
  const datumStr = String(formData.get("datum"));
  const date = new Date(datumStr);

  // Verteidigung in der Tiefe: die Middleware schützt die Seite bereits nach userId, hier
  // zusätzlich direkt in der Server Action geprüft (falls sie je losgelöst aufgerufen wird).
  const session = await auth();
  const rolle = (session?.user as { role?: string } | undefined)?.role;
  const meineId = (session?.user as { id?: string } | undefined)?.id;
  if (!session?.user || (rolle !== "ADMIN" && meineId !== userId)) {
    throw new NutzerFehler("Nicht berechtigt. Bitte Seite neu laden und erneut anmelden.");
  }

  const betroffenerUser = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  // Monatsabschluss: Mitarbeitende dürfen abgeschlossene Monate nicht mehr ändern, Admins schon
  // (z.B. für nachträgliche Korrekturen) — siehe CLAUDE.md, Feature "Monatsabschluss".
  if (rolle !== "ADMIN") {
    const geschlossen = await prisma.monthClose.findUnique({
      where: {
        companyId_year_month: {
          companyId: betroffenerUser.companyId,
          year: date.getUTCFullYear(),
          month: date.getUTCMonth() + 1,
        },
      },
    });
    if (geschlossen) {
      throw new NutzerFehler("Dieser Monat ist abgeschlossen und kann nicht mehr bearbeitet werden.");
    }
  }

  // Für die Krankmeldungs-Benachrichtigung: nur beim Wechsel von "nicht krank" auf "krank"
  // versenden, nicht bei jedem erneuten Speichern desselben Tages (siehe CLAUDE.md).
  const bisherigerEintrag = await prisma.dailyEntry.findUnique({ where: { userId_date: { userId, date } } });
  const warVorherKrank = (bisherigerEintrag?.krank ?? 0) > 0;
  const istJetztKrank = zahl(formData, "krank") > 0;

  const sollOverrideRaw = formData.get("sollOverride");
  const sollOverride =
    typeof sollOverrideRaw === "string" && sollOverrideRaw !== "" ? Number(sollOverrideRaw) : null;

  const entry = await mitWiederholung(() => prisma.dailyEntry.upsert({
    where: { userId_date: { userId, date } },
    update: {
      krank: zahl(formData, "krank"),
      reisezeit: zahl(formData, "reisezeit"),
      cad: zahl(formData, "cad"),
      ausbildung: zahl(formData, "ausbildung"),
      buero: zahl(formData, "buero"),
      ferien: zahl(formData, "ferien"),
      spesenFr: zahl(formData, "spesenFr"),
      km: zahl(formData, "km"),
      sollOverride,
      start1: minuten(formData, "start1"),
      stop1: minuten(formData, "stop1"),
      start2: minuten(formData, "start2"),
      stop2: minuten(formData, "stop2"),
      start3: minuten(formData, "start3"),
      stop3: minuten(formData, "stop3"),
      start4: minuten(formData, "start4"),
      stop4: minuten(formData, "stop4"),
    },
    create: {
      userId,
      date,
      krank: zahl(formData, "krank"),
      reisezeit: zahl(formData, "reisezeit"),
      cad: zahl(formData, "cad"),
      ausbildung: zahl(formData, "ausbildung"),
      buero: zahl(formData, "buero"),
      ferien: zahl(formData, "ferien"),
      spesenFr: zahl(formData, "spesenFr"),
      km: zahl(formData, "km"),
      sollOverride,
      start1: minuten(formData, "start1"),
      stop1: minuten(formData, "stop1"),
      start2: minuten(formData, "start2"),
      stop2: minuten(formData, "stop2"),
      start3: minuten(formData, "start3"),
      stop3: minuten(formData, "stop3"),
      start4: minuten(formData, "start4"),
      stop4: minuten(formData, "stop4"),
    },
  }));

  // Bis zu 6 Projekte pro Tag (siehe EntryForm.MAX_PROJEKTE, dort per "+ weiteres Projekt"
  // erweiterbar). Nicht ausgefuellte Felder senden schlicht keine projektId<i>, daher reicht
  // eine feste Obergrenze statt einer dynamischen Feldliste. Projekt kommt aus der festen Liste
  // (/projekte), label wird nur noch als Anzeige-Fallback fuer Altbuchungen mitgefuehrt.
  const gewuenscht: Array<{ projectId: string; stunden: number; kommentar: string }> = [];
  for (let i = 1; i <= 6; i++) {
    const projectId = formData.get(`projektId${i}`);
    const stunden = Number(formData.get(`projektStunden${i}`));
    const kommentar = String(formData.get(`projektKommentar${i}`) ?? "").trim();
    if (typeof projectId === "string" && projectId !== "" && Number.isFinite(stunden) && stunden > 0) {
      gewuenscht.push({ projectId, stunden, kommentar });
    }
  }

  // Alle benoetigten Projekte in EINER Abfrage statt je Buchung eine. Immer mit userId in der WHERE-
  // Klausel, analog zu projekte/actions.ts: verhindert, dass jemand per manipulierter Projekt-ID ein
  // fremdes Projekt (samt dessen Namen) in die eigene Buchung uebernimmt. userId ist hier die Person,
  // fuer die der Tag gespeichert wird (bei Admin-Bearbeitung also betroffenerUser).
  const projekte =
    gewuenscht.length > 0
      ? await prisma.project.findMany({
          where: { userId, id: { in: gewuenscht.map((g) => g.projectId) } },
          select: { id: true, name: true },
        })
      : [];
  const nameById = new Map(projekte.map((p) => [p.id, p.name]));
  const buchungen = gewuenscht
    .filter((g) => nameById.has(g.projectId))
    .map((g) => ({
      dailyEntryId: entry.id,
      projectId: g.projectId,
      label: nameById.get(g.projectId)!,
      hours: g.stunden,
      kommentar: g.kommentar,
    }));

  // Alte Buchungen ersetzen in einer Transaktion: ein Fehler mittendrin laesst den Tag nicht mehr
  // ohne Buchungen zurueck (vorher: erst loeschen, dann einzeln anlegen).
  await mitWiederholung(() =>
    prisma.$transaction([
      prisma.booking.deleteMany({ where: { dailyEntryId: entry.id } }),
      prisma.booking.createMany({ data: buchungen }),
    ]),
  );

  revalidatePath(`/mitarbeiter/${userId}/${jahr}/${monat}`);

  if (!warVorherKrank && istJetztKrank) {
    const admins = await prisma.user.findMany({
      where: { companyId: betroffenerUser.companyId, role: "ADMIN", id: { not: userId } },
      select: { email: true },
    });
    // Der Eintrag ist zu diesem Zeitpunkt schon gespeichert: scheitert nur der Mailversand, soll das
    // nicht als Speicherfehler beim Nutzer ankommen.
    try {
      await sendeKrankmeldung({
        mitarbeiterName: betroffenerUser.name,
        datumIso: datumStr,
        empfaengerEmails: admins.map((a) => a.email),
      });
    } catch (e) {
      console.error("Krankmeldung konnte nicht gesendet werden:", e);
    }
  }
}
