"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { parseISODate } from "@/lib/calc";
import { arbeitstageFuerZeitraum, ferienAntragStornieren } from "@/lib/ferienAntrag";

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
  const typ = formData.get("typ") === "gleitzeit" ? "gleitzeit" : "ferien";
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
      typ,
      kommentar: kommentar || null,
    },
  });

  revalidatePath("/abwesenheiten");
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

  revalidatePath("/abwesenheiten");
  revalidatePath("/admin/uebersicht");
}

export interface StornoState {
  error?: string;
  erfolg?: string;
}

// Genehmigten Antrag ganz oder teilweise stornieren (z.B. Ferien verschoben, Gleitzeit-Tag doch nicht
// noetig). Erlaubt fuer die eigene Person oder einen Admin; Nicht-Admins koennen abgeschlossene Monate
// nicht mehr aendern (wie bei der Tageserfassung).
export async function abwesenheitStornieren(_bisher: StornoState, formData: FormData): Promise<StornoState> {
  const session = await auth();
  if (!session?.user) return { error: "Sitzung abgelaufen. Bitte Seite neu laden." };
  const rolle = (session.user as { role?: string }).role;
  const meineId = (session.user as { id: string }).id;

  const antragId = String(formData.get("antragId") ?? "");
  const von = String(formData.get("von") ?? "");
  const bis = String(formData.get("bis") ?? "");
  if (!antragId || !/^\d{4}-\d{2}-\d{2}$/.test(von) || !/^\d{4}-\d{2}-\d{2}$/.test(bis)) {
    return { error: "Bitte Von- und Bis-Datum wählen." };
  }
  if (bis < von) return { error: "„Bis“ liegt vor „Von“." };

  const antrag = await prisma.ferienAntrag.findUnique({ where: { id: antragId }, include: { user: true } });
  if (!antrag) return { error: "Antrag nicht gefunden." };
  if (rolle !== "ADMIN" && antrag.userId !== meineId) return { error: "Nicht autorisiert." };

  if (rolle !== "ADMIN") {
    const start = von > antrag.von.toISOString().slice(0, 10) ? von : antrag.von.toISOString().slice(0, 10);
    const ende = bis < antrag.bis.toISOString().slice(0, 10) ? bis : antrag.bis.toISOString().slice(0, 10);
    const monate: { year: number; month: number }[] = [];
    let y = Number(start.slice(0, 4));
    let m = Number(start.slice(5, 7));
    while (y * 12 + m <= Number(ende.slice(0, 4)) * 12 + Number(ende.slice(5, 7))) {
      monate.push({ year: y, month: m });
      m++;
      if (m > 12) {
        m = 1;
        y++;
      }
    }
    const gesperrt = await prisma.monthClose.findFirst({
      where: { companyId: antrag.user.companyId, OR: monate },
    });
    if (gesperrt) {
      return {
        error: `Der Monat ${String(gesperrt.month).padStart(2, "0")}.${gesperrt.year} ist abgeschlossen. Bitte an einen Admin wenden.`,
      };
    }
  }

  const res = await ferienAntragStornieren(antragId, von, bis);
  if (res.error) return { error: res.error };

  revalidatePath("/abwesenheiten");
  revalidatePath("/admin/uebersicht");
  revalidatePath("/kalender");
  revalidatePath(`/mitarbeiter/${antrag.userId}`, "layout");
  return { erfolg: `Storniert (${res.tage} Arbeitstag${res.tage === 1 ? "" : "e"}).` };
}
