"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

async function eigeneUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user) throw new Error("Nicht angemeldet");
  return (session.user as { id: string }).id;
}

export async function notizHinzufuegen(formData: FormData) {
  const userId = await eigeneUserId();
  const datum = String(formData.get("datum") ?? "");
  const text = String(formData.get("text") ?? "").trim();
  const oeffentlich = formData.get("sichtbarkeit") === "oeffentlich";
  if (!datum || !text) return;

  await prisma.kalenderNotiz.create({
    data: { userId, date: new Date(datum), text, oeffentlich },
  });

  revalidatePath("/kalender");
}

export async function notizLoeschen(formData: FormData) {
  const userId = await eigeneUserId();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  // Immer mit userId in der WHERE-Klausel: jede Person kann nur ihre eigenen Notizen löschen,
  // auch öffentliche fremde Notizen nicht (analog zu den Projekt-Actions).
  await prisma.kalenderNotiz.deleteMany({ where: { id, userId } });
  revalidatePath("/kalender");
}
