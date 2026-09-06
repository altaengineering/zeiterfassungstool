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
  return session;
}

export async function feiertagHinzufuegen(formData: FormData) {
  const session = await pruefeAdmin();

  const datum = String(formData.get("datum") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  const bezahlt = formData.get("bezahlt") === "on";
  if (!datum || !label) return;

  const userId = (session.user as { id: string }).id;
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  await prisma.holiday.upsert({
    where: { companyId_date: { companyId: user.companyId, date: new Date(datum) } },
    update: { label, bezahlt },
    create: { companyId: user.companyId, date: new Date(datum), label, bezahlt },
  });

  revalidatePath("/admin/feiertage");
}

export async function feiertagLoeschen(formData: FormData) {
  await pruefeAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.holiday.delete({ where: { id } });
  revalidatePath("/admin/feiertage");
}
