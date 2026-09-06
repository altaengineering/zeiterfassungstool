"use server";

import bcrypt from "bcryptjs";
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
