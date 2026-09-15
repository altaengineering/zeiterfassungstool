"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { migriereEigeneBuchungenZuProjekten } from "@/lib/projects";

async function eigeneUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user) throw new Error("Nicht angemeldet");
  return (session.user as { id: string }).id;
}

export async function projektHinzufuegen(formData: FormData) {
  const userId = await eigeneUserId();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await prisma.project.upsert({
    where: { userId_name: { userId, name } },
    update: { aktiv: true },
    create: { userId, name },
  });

  revalidatePath("/projekte");
}

export async function projektAktivSchalten(formData: FormData) {
  const userId = await eigeneUserId();
  const id = String(formData.get("id") ?? "");
  const aktiv = formData.get("aktiv") === "true";
  if (!id) return;
  // Immer mit userId in der WHERE-Klausel: verhindert, dass jemand per manipulierter Projekt-ID
  // ein fremdes Projekt umschaltet (jede Person darf nur ihre eigenen Projekte ändern).
  await prisma.project.updateMany({ where: { id, userId }, data: { aktiv: !aktiv } });
  revalidatePath("/projekte");
}

export async function projektUmbenennen(formData: FormData) {
  const userId = await eigeneUserId();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) return;
  await prisma.project.updateMany({ where: { id, userId }, data: { name } });
  revalidatePath("/projekte");
}

export interface MigrateState {
  anzahl?: number;
}

export async function alteBuchungenMigrieren(
  _bisher: MigrateState,
  _formData: FormData,
): Promise<MigrateState> {
  const userId = await eigeneUserId();
  const anzahl = await migriereEigeneBuchungenZuProjekten(userId);
  revalidatePath("/projekte");
  return { anzahl };
}
