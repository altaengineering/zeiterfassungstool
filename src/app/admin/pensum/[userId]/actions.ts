"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

async function pruefeAdmin() {
  const session = await auth();
  const rolle = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || rolle !== "ADMIN") {
    throw new Error("Nicht autorisiert");
  }
}

export async function pensumWechselHinzufuegen(formData: FormData) {
  await pruefeAdmin();

  const userId = String(formData.get("userId") ?? "");
  const gueltigAb = String(formData.get("gueltigAb") ?? "");
  const anstellungPct = Number(formData.get("anstellungPct") ?? 0) / 100;
  const wochenstunden = Number(formData.get("wochenstunden") ?? 0);
  if (!userId || !gueltigAb || !Number.isFinite(anstellungPct) || !Number.isFinite(wochenstunden)) {
    return;
  }

  await prisma.pensumWechsel.upsert({
    where: { userId_gueltigAb: { userId, gueltigAb: new Date(gueltigAb) } },
    update: { anstellungPct, wochenstunden },
    create: { userId, gueltigAb: new Date(gueltigAb), anstellungPct, wochenstunden },
  });

  revalidatePath(`/admin/pensum/${userId}`);
}

export async function pensumWechselLoeschen(formData: FormData) {
  await pruefeAdmin();
  const id = String(formData.get("id") ?? "");
  const userId = String(formData.get("userId") ?? "");
  if (!id) return;
  await prisma.pensumWechsel.delete({ where: { id } });
  revalidatePath(`/admin/pensum/${userId}`);
}

// Stunden-/Ferienübertrag und Jahresferientage sind normalerweise Self-Service
// (/konto/einrichtung), aber nur beim eigenen Konto editierbar. Für direkte Korrekturen durch
// einen Admin (z.B. wenn jemand ein falsches Guthaben meldet) gibt es dort keine Möglichkeit,
// daher hier dieselben Felder zusätzlich admin-seitig für beliebige Nutzer:innen editierbar.
export async function stammdatenKorrigieren(formData: FormData) {
  await pruefeAdmin();

  const userId = String(formData.get("userId") ?? "");
  const jahr = Number(formData.get("jahr") ?? 0);
  const stundenuebertragAltesJahr = Number(formData.get("stundenuebertragAltesJahr") ?? 0);
  const ferienuebertragAltesJahr = Number(formData.get("ferienuebertragAltesJahr") ?? 0);
  const jahresferientageRaw = String(formData.get("jahresferientage") ?? "").trim();
  const jahresferientage = jahresferientageRaw === "" ? null : Number(jahresferientageRaw);
  if (
    !userId ||
    !jahr ||
    !Number.isFinite(stundenuebertragAltesJahr) ||
    !Number.isFinite(ferienuebertragAltesJahr) ||
    (jahresferientage != null && !Number.isFinite(jahresferientage))
  ) {
    return;
  }

  await prisma.jahresStammdaten.update({
    where: { userId_year: { userId, year: jahr } },
    data: { stundenuebertragAltesJahr, ferienuebertragAltesJahr, jahresferientage },
  });

  revalidatePath(`/admin/pensum/${userId}`);
}
