"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { migriereBuchungenZuProjekten } from "@/lib/projects";

async function eigeneCompanyIdAlsAdmin(): Promise<string> {
  const session = await auth();
  const rolle = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || rolle !== "ADMIN") {
    throw new Error("Nicht autorisiert");
  }
  const userId = (session.user as { id: string }).id;
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return user.companyId;
}

export async function projektHinzufuegen(formData: FormData) {
  const companyId = await eigeneCompanyIdAlsAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await prisma.project.upsert({
    where: { companyId_name: { companyId, name } },
    update: { aktiv: true },
    create: { companyId, name },
  });

  revalidatePath("/admin/projekte");
}

export async function projektAktivSchalten(formData: FormData) {
  await eigeneCompanyIdAlsAdmin();
  const id = String(formData.get("id") ?? "");
  const aktiv = formData.get("aktiv") === "true";
  if (!id) return;
  await prisma.project.update({ where: { id }, data: { aktiv: !aktiv } });
  revalidatePath("/admin/projekte");
}

export async function projektUmbenennen(formData: FormData) {
  await eigeneCompanyIdAlsAdmin();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) return;
  await prisma.project.update({ where: { id }, data: { name } });
  revalidatePath("/admin/projekte");
}

export interface MigrateState {
  anzahl?: number;
}

export async function alteBuchungenMigrieren(
  _bisher: MigrateState,
  _formData: FormData,
): Promise<MigrateState> {
  const companyId = await eigeneCompanyIdAlsAdmin();
  const anzahl = await migriereBuchungenZuProjekten(companyId);
  revalidatePath("/admin/projekte");
  return { anzahl };
}
