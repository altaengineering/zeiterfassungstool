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
