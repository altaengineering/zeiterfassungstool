"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { STANDARD_JAHRESFERIENTAGE } from "@/lib/calc";
import { berechneFerienSaldo, berechneUebertragAusAktuellemSaldo } from "@/lib/ferienSaldo";

export interface FerienEinrichtungState {
  error?: string;
  success?: boolean;
}

// Bewusst nur die zwei Felder, die der Ferien-Hinweis im Layout verspricht (aktueller Saldo +
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

  const aktuellerSaldo = Number(formData.get("aktuellerSaldo") ?? 0);
  const jahresferientageRaw = String(formData.get("jahresferientage") ?? "").trim();
  const jahresferientage = jahresferientageRaw === "" ? null : Number(jahresferientageRaw);

  if (!Number.isFinite(aktuellerSaldo)) {
    return { error: "Bitte eine gültige Zahl für deinen aktuellen Ferien-Saldo eingeben." };
  }
  if (jahresferientage != null && !Number.isFinite(jahresferientage)) {
    return { error: "Bitte eine gültige Zahl für die Ferientage pro Jahr eingeben, oder leer lassen." };
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const [stammdaten, companySettings, saldoVorher] = await Promise.all([
    prisma.jahresStammdaten.findUnique({ where: { userId_year: { userId, year: jahr } } }),
    prisma.companySettings.findUnique({
      where: { companyId_year: { companyId: user.companyId, year: jahr } },
    }),
    berechneFerienSaldo(userId, jahr),
  ]);
  if (!stammdaten || !saldoVorher) {
    return { error: `Keine Jahres-Stammdaten für ${jahr} gefunden. Bitte bei einem Admin melden.` };
  }

  const standardJahresferientage = companySettings?.jahresferientage ?? STANDARD_JAHRESFERIENTAGE;
  const effektivJahresferientage = jahresferientage ?? standardJahresferientage;
  // Bereits bezogene Tage aus dem VOR dieser Änderung berechneten Saldo — unabhängig davon, was
  // gleich neu gespeichert wird (wochenstunden/anstellungPct/Kalender-Einträge ändert dieses
  // Formular nicht), siehe berechneUebertragAusAktuellemSaldo für die Herleitung.
  const neuerUebertrag = berechneUebertragAusAktuellemSaldo(
    aktuellerSaldo,
    saldoVorher.ferienBezogen,
    stammdaten.arbeitsmonate,
    effektivJahresferientage,
  );

  try {
    await prisma.jahresStammdaten.update({
      where: { userId_year: { userId, year: jahr } },
      data: {
        ferienuebertragAltesJahr: neuerUebertrag,
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
