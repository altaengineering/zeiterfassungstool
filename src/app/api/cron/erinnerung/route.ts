import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendeErinnerung } from "@/lib/email";

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Läuft per Vercel Cron Di-Sa (siehe vercel.json), prüft jeweils den letzten Werktag (Mo-Fr) davor.
// So bekommt niemand am Wochenende eine Erinnerung, und die Erinnerung für Freitag kommt am
// Samstag, nicht erst am Montag. Vercel setzt bei konfiguriertem CRON_SECRET automatisch den
// Authorization-Header, ohne den Secret kann die Route jeder von aussen auslösen (Erinnerungen an
// alle verschicken), daher hart abgelehnt statt nur best-effort geprüft.
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET nicht konfiguriert" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  const gestern = new Date();
  gestern.setUTCDate(gestern.getUTCDate() - 1);
  const wochentag = gestern.getUTCDay();
  if (wochentag === 0 || wochentag === 6) {
    return NextResponse.json({ uebersprungen: "Vortag war ein Wochenende" });
  }

  const gesternIso = iso(gestern);
  const gesternDate = new Date(`${gesternIso}T00:00:00Z`);
  const jahr = gestern.getUTCFullYear();

  const companies = await prisma.company.findMany({
    include: { users: { where: { role: "MITARBEITER" } } },
  });

  let anzahlErinnerungen = 0;
  for (const company of companies) {
    const feiertag = await prisma.holiday.findFirst({
      where: { companyId: company.id, date: gesternDate, bezahlt: true },
    });
    if (feiertag) continue;

    for (const user of company.users) {
      const [stammdaten, entry] = await Promise.all([
        prisma.jahresStammdaten.findUnique({ where: { userId_year: { userId: user.id, year: jahr } } }),
        prisma.dailyEntry.findUnique({ where: { userId_date: { userId: user.id, date: gesternDate } } }),
      ]);
      if (entry) continue;
      if (stammdaten?.erfassungStartDatum && gesternIso < iso(stammdaten.erfassungStartDatum)) continue;

      await sendeErinnerung({ mitarbeiterName: user.name, empfaengerEmail: user.email, datumIso: gesternIso });
      anzahlErinnerungen++;
    }
  }

  return NextResponse.json({ ok: true, geprueft: gesternIso, anzahlErinnerungen });
}
