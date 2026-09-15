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

export async function projektLoeschen(formData: FormData) {
  const userId = await eigeneUserId();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  // Nur deaktivierte, eigene Projekte duerfen geloescht werden (aktive muss man erst
  // deaktivieren, damit man nicht aus Versehen ein gerade genutztes Projekt entfernt). Alte
  // Buchungen auf diesem Projekt verlieren dabei nur ihre Verknuepfung (onDelete: SetNull im
  // Schema), ihr Text (label) und die Stunden bleiben erhalten und sind weiterhin sichtbar.
  await prisma.project.deleteMany({ where: { id, userId, aktiv: false } });
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
