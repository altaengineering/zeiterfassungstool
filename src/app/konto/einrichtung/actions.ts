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

// Self-Service-Rückgängig, falls jemand die Einrichtung fälschlicherweise ausgefüllt hat, obwohl
// bereits echte historische Tageseinträge bestehen (Soll wird sonst für alle Tage vor dem
// eingetragenen Startdatum auf 0 gezwungen — das verfälscht dann einen bereits korrekten Saldo).
export async function einrichtungZuruecksetzen(
  _bisher: EinrichtungState,
  _formData: FormData,
): Promise<EinrichtungState> {
  const session = await auth();
  if (!session?.user) return { error: "Sitzung abgelaufen. Bitte Seite neu laden." };

  const userId = (session.user as { id: string }).id;
  const jahr = new Date().getFullYear();

  try {
    await prisma.jahresStammdaten.update({
      where: { userId_year: { userId, year: jahr } },
      data: { erfassungStartDatum: null, stundenuebertragAltesJahr: 0, ferienuebertragAltesJahr: 0 },
    });
  } catch {
    return {
      error: `Keine Jahres-Stammdaten für ${jahr} gefunden. Bitte bei einem Admin melden.`,
    };
  }

  return { success: true };
}
