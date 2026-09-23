"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { STANDARD_JAHRESFERIENTAGE } from "@/lib/calc";
import { berechneFerienSaldo, berechneUebertragAusAktuellemSaldo } from "@/lib/ferienSaldo";

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
  const aktuellerSaldo = Number(formData.get("aktuellerSaldo") ?? 0);
  const jahresferientageRaw = String(formData.get("jahresferientage") ?? "").trim();
  const jahresferientage = jahresferientageRaw === "" ? null : Number(jahresferientageRaw);
  const ferienBezogenKorrektur = Number(formData.get("ferienBezogenKorrektur") ?? 0);

  if (!startdatum) return { error: "Bitte ein Startdatum wählen." };
  if (!Number.isFinite(stundenSaldo) || !Number.isFinite(aktuellerSaldo)) {
    return { error: "Bitte gültige Zahlen für Stunden und Ferien eingeben." };
  }
  if (jahresferientage != null && !Number.isFinite(jahresferientage)) {
    return { error: "Bitte eine gültige Zahl für die Ferientage pro Jahr eingeben, oder leer lassen." };
  }
  if (!Number.isFinite(ferienBezogenKorrektur)) {
    return { error: "Bitte eine gültige Zahl für die zusätzlich verbrauchten Ferientage eingeben." };
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
  // saldoVorher.ferienBezogen rechnet noch mit der ALTEN ferienBezogenKorrektur, wird aber gleich
  // durch die NEUE ersetzt — erst auf die reinen Kalender-Einträge zurückrechnen, dann die neue
  // Korrektur draufrechnen, sonst bekäme berechneUebertragAusAktuellemSaldo unten einen leicht
  // falschen "bereits bezogen"-Wert (siehe Kommentar dort für die Herleitung).
  const ausEintraegen = saldoVorher.ferienBezogen - stammdaten.ferienBezogenKorrektur;
  const bereitsBezogen = ausEintraegen + ferienBezogenKorrektur;
  const neuerUebertrag = berechneUebertragAusAktuellemSaldo(
    aktuellerSaldo,
    bereitsBezogen,
    stammdaten.arbeitsmonate,
    effektivJahresferientage,
  );

  try {
    await prisma.jahresStammdaten.update({
      where: { userId_year: { userId, year: jahr } },
      data: {
        erfassungStartDatum: new Date(startdatum),
        stundenuebertragAltesJahr: stundenSaldo,
        ferienuebertragAltesJahr: neuerUebertrag,
        jahresferientage,
        ferienBezogenKorrektur,
        // Die grosse Einrichtung deckt die Ferien-Felder mit ab, zaehlt also auch als erledigt
        // fuer den separaten Ferien-Hinweis (siehe layout.tsx / konto/ferien-einrichtung).
        ferienEinrichtungErledigt: true,
      },
    });
  } catch {
    return {
      error: `Keine Jahres-Stammdaten für ${jahr} gefunden. Bitte bei einem Admin melden.`,
    };
  }

  // "layout" revalidiert das RootLayout mit: der einmalige Einrichtungs-Hinweis dort (siehe
  // layout.tsx) muss sofort verschwinden, nicht erst beim naechsten harten Neuladen — ohne dies
  // aktualisiert ein Server-Action-Aufruf zwar diese Seite, aber nicht zwangslaeufig das Layout.
  revalidatePath("/", "layout");

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
      data: {
        erfassungStartDatum: null,
        stundenuebertragAltesJahr: 0,
        ferienuebertragAltesJahr: 0,
        ferienEinrichtungErledigt: false,
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
