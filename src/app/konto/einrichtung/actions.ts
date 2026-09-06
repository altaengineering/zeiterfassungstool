"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export interface EinrichtungState {
  error?: string;
  success?: boolean;
}

export async function einrichtungSpeichern(
  _bisher: EinrichtungState,
  formData: FormData,
): Promise<EinrichtungState> {
  const session = await auth();
  if (!session?.user) return { error: "Sitzung abgelaufen. Bitte Seite neu laden." };

  const userId = (session.user as { id: string }).id;
  const jahr = new Date().getFullYear();

  const startdatum = String(formData.get("startdatum") ?? "");
  const stundenSaldo = Number(formData.get("stundenSaldo") ?? 0);
  const ferienGuthaben = Number(formData.get("ferienGuthaben") ?? 0);

  if (!startdatum) return { error: "Bitte ein Startdatum wählen." };
  if (!Number.isFinite(stundenSaldo) || !Number.isFinite(ferienGuthaben)) {
    return { error: "Bitte gültige Zahlen für Stunden und Ferien eingeben." };
  }

  try {
    await prisma.jahresStammdaten.update({
      where: { userId_year: { userId, year: jahr } },
      data: {
        erfassungStartDatum: new Date(startdatum),
        stundenuebertragAltesJahr: stundenSaldo,
        ferienuebertragAltesJahr: ferienGuthaben,
      },
    });
  } catch {
    return {
      error: `Keine Jahres-Stammdaten für ${jahr} gefunden. Bitte bei einem Admin melden.`,
    };
  }

  return { success: true };
}
