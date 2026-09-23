"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export interface FerienEinrichtungState {
  error?: string;
  success?: boolean;
}

// Bewusst nur die zwei Felder, die der Ferien-Hinweis im Layout verspricht (Guthaben +
// Jahresanspruch), siehe Kommentar bei JahresStammdaten.ferienEinrichtungErledigt. Nicht die
// grosse Einrichtung (Startdatum/Ueberstunden) — wer die auch braucht, findet sie weiterhin unter
// Konto -> Einrichtung.
export async function ferienEinrichtungSpeichern(
  _bisher: FerienEinrichtungState,
  formData: FormData,
): Promise<FerienEinrichtungState> {
  const session = await auth();
  if (!session?.user) return { error: "Sitzung abgelaufen. Bitte Seite neu laden." };

  const userId = (session.user as { id: string }).id;
  const jahr = new Date().getFullYear();

  const ferienGuthaben = Number(formData.get("ferienGuthaben") ?? 0);
  const jahresferientageRaw = String(formData.get("jahresferientage") ?? "").trim();
  const jahresferientage = jahresferientageRaw === "" ? null : Number(jahresferientageRaw);

  if (!Number.isFinite(ferienGuthaben)) {
    return { error: "Bitte eine gültige Zahl für dein Ferien-Guthaben eingeben." };
  }
  if (jahresferientage != null && !Number.isFinite(jahresferientage)) {
    return { error: "Bitte eine gültige Zahl für die Ferientage pro Jahr eingeben, oder leer lassen." };
  }

  try {
    await prisma.jahresStammdaten.update({
      where: { userId_year: { userId, year: jahr } },
      data: {
        ferienuebertragAltesJahr: ferienGuthaben,
        jahresferientage,
        ferienEinrichtungErledigt: true,
      },
    });
  } catch {
    return {
      error: `Keine Jahres-Stammdaten für ${jahr} gefunden. Bitte bei einem Admin melden.`,
    };
  }

  revalidatePath("/", "layout");

  return { success: true };
}
