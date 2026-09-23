"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { parseISODate } from "@/lib/calc";
import { arbeitstageFuerZeitraum } from "@/lib/ferienAntrag";

export interface FerienAntragState {
  error?: string;
  success?: boolean;
}

export async function ferienBeantragen(
  _bisher: FerienAntragState,
  formData: FormData,
): Promise<FerienAntragState> {
  const session = await auth();
  if (!session?.user) return { error: "Sitzung abgelaufen. Bitte Seite neu laden." };

  const userId = (session.user as { id: string }).id;
  const von = String(formData.get("von") ?? "");
  const bis = String(formData.get("bis") ?? "");
  const kommentar = String(formData.get("kommentar") ?? "").trim();

  if (!von || !bis) return { error: "Bitte Start- und Enddatum angeben." };
  if (von > bis) return { error: "Das Startdatum muss vor oder gleich dem Enddatum liegen." };

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const tage = await arbeitstageFuerZeitraum(user.companyId, von, bis);
  if (tage.length === 0) {
    return { error: "Im gewählten Zeitraum liegt kein einziger Arbeitstag (nur Wochenende/Feiertage)." };
  }

  await prisma.ferienAntrag.create({
    data: {
      userId,
      von: parseISODate(von),
      bis: parseISODate(bis),
      arbeitstage: tage.length,
      kommentar: kommentar || null,
    },
  });

  revalidatePath("/ferien");
  revalidatePath("/admin/uebersicht");
  return { success: true };
}

export async function ferienAntragZuruecknehmen(formData: FormData) {
  const session = await auth();
  if (!session?.user) return;
  const userId = (session.user as { id: string }).id;

  const antragId = String(formData.get("antragId") ?? "");
  if (!antragId) return;

  // Nur eigene, noch offene Antraege koennen zurueckgenommen werden — kein Loeschen bereits
  // entschiedener Antraege, damit die Historie (auch abgelehnte) fuer Admin und Person erhalten bleibt.
  await prisma.ferienAntrag.deleteMany({ where: { id: antragId, userId, status: "offen" } });

  revalidatePath("/ferien");
  revalidatePath("/admin/uebersicht");
}
