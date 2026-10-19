"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { berechneUebernahme, feiertageVorschlag, stelleStammdatenSicher } from "@/lib/jahreswechsel";

async function pruefeAdmin() {
  const session = await auth();
  const rolle = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || rolle !== "ADMIN") {
    throw new Error("Nicht autorisiert");
  }
  return session;
}

function leseJahr(formData: FormData): number {
  const jahr = Number(formData.get("jahr"));
  if (!Number.isInteger(jahr) || jahr < 2000 || jahr > 2100) throw new Error("Ungültiges Jahr");
  return jahr;
}

/** Legt für alle Personen ohne Jahresdaten im Zieljahr die Zeile an (Übertrag aus dem Vorjahr). */
export async function jahrVorbereiten(formData: FormData) {
  const session = await pruefeAdmin();
  const jahr = leseJahr(formData);
  const adminId = (session.user as { id: string }).id;
  const admin = await prisma.user.findUniqueOrThrow({ where: { id: adminId } });
  const users = await prisma.user.findMany({ where: { companyId: admin.companyId } });
  for (const u of users) {
    await stelleStammdatenSicher(u.id, jahr);
  }
  revalidatePath("/admin/jahreswechsel");
}

/** Rechnet Stunden- und Ferienübertrag einer Person aus dem Vorjahr neu und überschreibt die Werte. */
export async function uebertragNeuRechnen(formData: FormData) {
  await pruefeAdmin();
  const jahr = leseJahr(formData);
  const userId = String(formData.get("userId") ?? "");
  if (!userId) return;
  const u = await berechneUebernahme(userId, jahr - 1);
  if (!u) return;
  await prisma.jahresStammdaten.update({
    where: { userId_year: { userId, year: jahr } },
    data: { stundenuebertragAltesJahr: u.stundenuebertrag, ferienuebertragAltesJahr: u.ferienuebertrag },
  });
  revalidatePath("/admin/jahreswechsel");
}

/** Übernimmt die Feiertage des Vorjahres für das Zieljahr (bewegliche aus Ostern berechnet). */
export async function feiertageUebernehmen(formData: FormData) {
  const session = await pruefeAdmin();
  const jahr = leseJahr(formData);
  const adminId = (session.user as { id: string }).id;
  const admin = await prisma.user.findUniqueOrThrow({ where: { id: adminId } });
  const vorschlag = await feiertageVorschlag(admin.companyId, jahr);
  for (const f of vorschlag) {
    await prisma.holiday.upsert({
      where: { companyId_date: { companyId: admin.companyId, date: new Date(f.date) } },
      update: {},
      create: { companyId: admin.companyId, date: new Date(f.date), label: f.label, bezahlt: f.bezahlt },
    });
  }
  revalidatePath("/admin/jahreswechsel");
  revalidatePath("/admin/feiertage");
}
