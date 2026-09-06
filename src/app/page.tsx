import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

// Live-Daten aus der DB — nie statisch vorrendern (sonst zeigt die Seite einen eingefrorenen
// Stand vom Build-Zeitpunkt, siehe CLAUDE.md Deployment-Hinweise).
export const dynamic = "force-dynamic";

function aktuellerMonatPfad(userId: string): string {
  const jetzt = new Date();
  return `/mitarbeiter/${userId}/${jetzt.getFullYear()}/${jetzt.getMonth() + 1}`;
}

// Jede:r (auch Admins) landet direkt in der eigenen aktuellen Monatsansicht. Die Übersicht
// aller Mitarbeitenden gibt es nur noch an einer Stelle: "Nutzerverwaltung" (/admin, nur für
// Admin-Rolle, siehe Link in der Kopfzeile) — vorher gab es die Liste doppelt (hier und dort).
export default async function StartPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const meineId = (session.user as { id?: string }).id;
  if (!meineId) redirect("/login");

  redirect(aktuellerMonatPfad(meineId));
}
