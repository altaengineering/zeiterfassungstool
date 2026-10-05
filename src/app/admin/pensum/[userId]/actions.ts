"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { berechneUebertragAusAktuellemStundenSaldo } from "@/lib/calc";
import { berechneAkkumulierteStundenBisHeute } from "@/lib/monatsStand";

async function pruefeAdmin() {
  const session = await auth();
  const rolle = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || rolle !== "ADMIN") {
    throw new Error("Nicht autorisiert");
  }
}

export async function pensumWechselHinzufuegen(formData: FormData) {
  await pruefeAdmin();

  const userId = String(formData.get("userId") ?? "");
  const gueltigAb = String(formData.get("gueltigAb") ?? "");
  const anstellungPct = Number(formData.get("anstellungPct") ?? 0) / 100;
  const wochenstunden = Number(formData.get("wochenstunden") ?? 0);
  if (!userId || !gueltigAb || !Number.isFinite(anstellungPct) || !Number.isFinite(wochenstunden)) {
    return;
  }

  await prisma.pensumWechsel.upsert({
    where: { userId_gueltigAb: { userId, gueltigAb: new Date(gueltigAb) } },
    update: { anstellungPct, wochenstunden },
    create: { userId, gueltigAb: new Date(gueltigAb), anstellungPct, wochenstunden },
  });

  revalidatePath(`/admin/pensum/${userId}`);
}

export async function pensumWechselLoeschen(formData: FormData) {
  await pruefeAdmin();
  const id = String(formData.get("id") ?? "");
  const userId = String(formData.get("userId") ?? "");
  if (!id) return;
  await prisma.pensumWechsel.delete({ where: { id } });
  revalidatePath(`/admin/pensum/${userId}`);
}

// Stunden-/Ferienübertrag und Jahresferientage sind normalerweise Self-Service
// (/konto/einrichtung), aber nur beim eigenen Konto editierbar. Für direkte Korrekturen durch
// einen Admin (z.B. wenn jemand ein falsches Guthaben meldet) gibt es dort keine Möglichkeit,
// daher hier dieselben Felder zusätzlich admin-seitig für beliebige Nutzer:innen editierbar.
export async function stammdatenKorrigieren(formData: FormData) {
  await pruefeAdmin();

  const userId = String(formData.get("userId") ?? "");
  const jahr = Number(formData.get("jahr") ?? 0);
  const stundenuebertragAltesJahr = Number(formData.get("stundenuebertragAltesJahr") ?? 0);
  const ferienuebertragAltesJahr = Number(formData.get("ferienuebertragAltesJahr") ?? 0);
  const jahresferientageRaw = String(formData.get("jahresferientage") ?? "").trim();
  const jahresferientage = jahresferientageRaw === "" ? null : Number(jahresferientageRaw);
  const ferienBezogenKorrektur = Number(formData.get("ferienBezogenKorrektur") ?? 0);
  if (
    !userId ||
    !jahr ||
    !Number.isFinite(stundenuebertragAltesJahr) ||
    !Number.isFinite(ferienuebertragAltesJahr) ||
    (jahresferientage != null && !Number.isFinite(jahresferientage)) ||
    !Number.isFinite(ferienBezogenKorrektur)
  ) {
    return;
  }

  await prisma.jahresStammdaten.update({
    where: { userId_year: { userId, year: jahr } },
    data: { stundenuebertragAltesJahr, ferienuebertragAltesJahr, jahresferientage, ferienBezogenKorrektur },
  });

  revalidatePath(`/admin/pensum/${userId}`);
}

// Schnellkorrektur fuer den haeufigsten Admin-Fall: "ich habe gerade X Stunden/Tage ausbezahlt,
// die muessen weg vom Saldo" — ohne dass der Chef erst den neuen absoluten Startwert selbst
// ausrechnen muss (siehe Kommentar auf der Seite: vorher musste man den Startwert so lange
// anpassen, bis der angezeigte Stand stimmte). Negative Eingabe ist bewusst erlaubt, damit sich
// ein Versehen direkt mit derselben Aktion (negative Zahl eintippen) wieder geradeziehen laesst,
// statt extra zur Detail-Korrektur unten wechseln zu muessen.

export async function stundenAuszahlen(formData: FormData) {
  await pruefeAdmin();

  const userId = String(formData.get("userId") ?? "");
  const jahr = Number(formData.get("jahr") ?? 0);
  const stunden = Number(formData.get("stunden") ?? NaN);
  if (!userId || !jahr || !Number.isFinite(stunden) || stunden === 0) return;

  await prisma.jahresStammdaten.update({
    where: { userId_year: { userId, year: jahr } },
    data: { stundenuebertragAltesJahr: { decrement: stunden } },
  });

  revalidatePath(`/admin/pensum/${userId}`);
}

// "Der Gleitzeit-Stand soll X sein": rechnet den passenden Startwert (Uebertrag 1. Januar) selbst
// aus, statt dass der Chef ihn von Hand so lange anpassen muss, bis die Anzeige stimmt. Gleiche
// Definition wie die Karte "Gleitzeit-Stand (aktuell)" und der Excel-Export: Stand bis einschliesslich
// gestern, gerechnet mit dem hinterlegten Startdatum (Tage davor zaehlen nicht).
export async function gleitzeitStandSetzen(formData: FormData) {
  await pruefeAdmin();

  const userId = String(formData.get("userId") ?? "");
  const jahr = Number(formData.get("jahr") ?? 0);
  const ziel = Number(formData.get("ziel") ?? NaN);
  if (!userId || !jahr || !Number.isFinite(ziel)) return;

  const akkumuliert = await berechneAkkumulierteStundenBisHeute(userId, jahr);
  await prisma.jahresStammdaten.update({
    where: { userId_year: { userId, year: jahr } },
    data: { stundenuebertragAltesJahr: berechneUebertragAusAktuellemStundenSaldo(ziel, akkumuliert) },
  });

  revalidatePath(`/admin/pensum/${userId}`);
}

export async function ferientageAuszahlen(formData: FormData) {
  await pruefeAdmin();

  const userId = String(formData.get("userId") ?? "");
  const jahr = Number(formData.get("jahr") ?? 0);
  const tage = Number(formData.get("tage") ?? NaN);
  if (!userId || !jahr || !Number.isFinite(tage) || tage === 0) return;

  // Eine Auszahlung zaehlt wie ein genommener, aber nie im Kalender erfasster Ferientag -> derselbe
  // Mechanismus wie "Zusaetzlich verbrauchte Ferientage" unten, nur additiv statt als Absolutwert.
  await prisma.jahresStammdaten.update({
    where: { userId_year: { userId, year: jahr } },
    data: { ferienBezogenKorrektur: { increment: tage } },
  });

  revalidatePath(`/admin/pensum/${userId}`);
}
