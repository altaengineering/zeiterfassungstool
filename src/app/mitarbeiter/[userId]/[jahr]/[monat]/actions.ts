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

export async function tageseintragSpeichern(formData: FormData) {
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
    throw new Error("Nicht autorisiert");
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
      throw new Error("Dieser Monat ist abgeschlossen und kann nicht mehr bearbeitet werden.");
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

  const entry = await prisma.dailyEntry.upsert({
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
  });

  await prisma.booking.deleteMany({ where: { dailyEntryId: entry.id } });
  // Bis zu 6 Projekte pro Tag (siehe EntryForm.MAX_PROJEKTE, dort per "+ weiteres Projekt"
  // erweiterbar). Nicht ausgefuellte Felder senden schlicht kein projektLabel<i>, daher reicht
  // eine feste Obergrenze statt einer dynamischen Feldliste.
  for (let i = 1; i <= 6; i++) {
    const label = formData.get(`projektLabel${i}`);
    const stunden = Number(formData.get(`projektStunden${i}`));
    if (typeof label === "string" && label.trim() !== "" && Number.isFinite(stunden) && stunden > 0) {
      await prisma.booking.create({
        data: { dailyEntryId: entry.id, label: label.trim(), hours: stunden },
      });
    }
  }

  revalidatePath(`/mitarbeiter/${userId}/${jahr}/${monat}`);

  if (!warVorherKrank && istJetztKrank) {
    const admins = await prisma.user.findMany({
      where: { companyId: betroffenerUser.companyId, role: "ADMIN", id: { not: userId } },
      select: { email: true },
    });
    await sendeKrankmeldung({
      mitarbeiterName: betroffenerUser.name,
      datumIso: datumStr,
      empfaengerEmails: admins.map((a) => a.email),
    });
  }
}
