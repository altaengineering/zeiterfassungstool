"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { generiereZufallsPasswort } from "@/lib/passwort";

export interface ResetState {
  error?: string;
  neuesPasswort?: string;
}

export async function passwortZuruecksetzen(
  _bisher: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const session = await auth();
  const rolle = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || rolle !== "ADMIN") {
    return { error: "Nicht autorisiert." };
  }

  const userId = String(formData.get("userId") ?? "");
  if (!userId) return { error: "Kein Nutzer angegeben." };

  const neuesPasswort = generiereZufallsPasswort();
  const passwordHash = await bcrypt.hash(neuesPasswort, 10);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

  return { neuesPasswort };
}

export interface NeuerNutzerState {
  error?: string;
  neuesPasswort?: string;
  email?: string;
}

async function pruefeAdmin() {
  const session = await auth();
  const rolle = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || rolle !== "ADMIN") {
    throw new Error("Nicht autorisiert");
  }
  return session;
}

export async function nutzerHinzufuegen(
  _bisher: NeuerNutzerState,
  formData: FormData,
): Promise<NeuerNutzerState> {
  const session = await pruefeAdmin();
  const adminId = (session.user as { id: string }).id;
  const admin = await prisma.user.findUniqueOrThrow({ where: { id: adminId } });

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const anstellungPct = Number(formData.get("anstellungPct") ?? 100) / 100;
  const wochenstunden = Number(formData.get("wochenstunden") ?? 42);
  const rolle = formData.get("rolle") === "ADMIN" ? "ADMIN" : "MITARBEITER";

  if (!name || !email) return { error: "Name und E-Mail sind Pflichtfelder." };
  if (!Number.isFinite(anstellungPct) || !Number.isFinite(wochenstunden)) {
    return { error: "Anstellung % und Wochenstunden müssen Zahlen sein." };
  }

  const vorhanden = await prisma.user.findUnique({ where: { email } });
  if (vorhanden) return { error: `E-Mail ${email} ist bereits vergeben.` };

  const neuesPasswort = generiereZufallsPasswort();
  const passwordHash = await bcrypt.hash(neuesPasswort, 10);
  const jahr = new Date().getFullYear();

  await prisma.user.create({
    data: {
      companyId: admin.companyId,
      name,
      email,
      passwordHash,
      role: rolle,
      jahresStammdaten: {
        create: {
          year: jahr,
          anstellungPct,
          wochenstunden,
          anzahlVorholtage: 0,
          stundenuebertragAltesJahr: 0,
          ferienuebertragAltesJahr: 0,
          arbeitsmonate: 12,
        },
      },
    },
  });

  revalidatePath("/admin");
  return { neuesPasswort, email };
}

export async function nutzerLoeschen(formData: FormData) {
  const session = await pruefeAdmin();
  const meineId = (session.user as { id: string }).id;
  const userId = String(formData.get("userId") ?? "");
  if (!userId || userId === meineId) return;

  await prisma.booking.deleteMany({ where: { dailyEntry: { userId } } });
  await prisma.dailyEntry.deleteMany({ where: { userId } });
  await prisma.jahresStammdaten.deleteMany({ where: { userId } });
  await prisma.pensumWechsel.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } });
  revalidatePath("/admin");
}
