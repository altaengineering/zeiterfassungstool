"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export interface PasswortState {
  error?: string;
  success?: boolean;
}

// Gibt bewusst einen Status zurück statt redirect() zu nutzen: redirect() innerhalb einer Server
// Action auf einer durch die Middleware geschützten Seite hat hier zuverlässig das Session-Cookie
// verloren (next-auth v5 ist noch Beta) — mit useActionState + Inline-Anzeige umgehen wir das.
export async function passwortAendern(
  _bisher: PasswortState,
  formData: FormData,
): Promise<PasswortState> {
  const session = await auth();
  if (!session?.user) {
    return { error: "Sitzung abgelaufen. Bitte Seite neu laden und erneut versuchen." };
  }

  const userId = (session.user as { id: string }).id;
  const aktuelles = String(formData.get("aktuelles") ?? "");
  const neues = String(formData.get("neues") ?? "");
  const wiederholung = String(formData.get("wiederholung") ?? "");

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  const gueltig = await bcrypt.compare(aktuelles, user.passwordHash);
  if (!gueltig) {
    return { error: "Aktuelles Passwort ist falsch." };
  }
  if (neues.length < 8) {
    return { error: "Neues Passwort muss mindestens 8 Zeichen haben." };
  }
  if (neues !== wiederholung) {
    return { error: "Die beiden neuen Passwörter stimmen nicht überein." };
  }

  const passwordHash = await bcrypt.hash(neues, 10);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

  return { success: true };
}
