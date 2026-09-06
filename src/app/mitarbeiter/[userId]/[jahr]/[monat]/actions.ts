"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

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
  for (const i of [1, 2] as const) {
    const label = formData.get(`projektLabel${i}`);
    const stunden = Number(formData.get(`projektStunden${i}`));
    if (typeof label === "string" && label.trim() !== "" && Number.isFinite(stunden) && stunden > 0) {
      await prisma.booking.create({
        data: { dailyEntryId: entry.id, label: label.trim(), hours: stunden },
      });
    }
  }

  revalidatePath(`/mitarbeiter/${userId}/${jahr}/${monat}`);
}
