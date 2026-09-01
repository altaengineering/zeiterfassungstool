import { PrismaClient } from "@prisma/client";
import { STANDARD_JAHRESFERIENTAGE } from "../src/lib/calc";
import feiertage2026 from "./seed-data/feiertage-2026.json";
import juniDaten from "./seed-data/jun-2026-michael-kueng.json";

const prisma = new PrismaClient();

async function main() {
  const company = await prisma.company.upsert({
    where: { id: "alta-engineering" },
    update: {},
    create: { id: "alta-engineering", name: "Alta Engineering AG" },
  });

  await prisma.companySettings.upsert({
    where: { companyId_year: { companyId: company.id, year: 2026 } },
    update: {},
    create: {
      companyId: company.id,
      year: 2026,
      kmSpesensatz: 0.7,
      jahresferientage: STANDARD_JAHRESFERIENTAGE,
    },
  });

  for (const f of feiertage2026) {
    await prisma.holiday.upsert({
      where: { companyId_date: { companyId: company.id, date: new Date(f.date) } },
      update: { label: f.label, bezahlt: f.bezahlt },
      create: { companyId: company.id, date: new Date(f.date), label: f.label, bezahlt: f.bezahlt },
    });
  }

  const michael = await prisma.user.upsert({
    where: { email: "michael.kueng@alta-engineering.ch" },
    update: {},
    create: {
      companyId: company.id,
      name: "Michael Küng",
      email: "michael.kueng@alta-engineering.ch",
      // POC: kein echtes Auth-System implementiert, nur Platzhalter (siehe CLAUDE.md Status).
      passwordHash: "POC-KEIN-ECHTES-LOGIN",
      role: "MITARBEITER",
    },
  });

  const stefan = await prisma.user.upsert({
    where: { email: "stefan@alta-engineering.ch" },
    update: {},
    create: {
      companyId: company.id,
      name: "Stefan",
      email: "stefan@alta-engineering.ch",
      passwordHash: "POC-KEIN-ECHTES-LOGIN",
      role: "ADMIN",
    },
  });

  await prisma.jahresStammdaten.upsert({
    where: { userId_year: { userId: michael.id, year: 2026 } },
    update: {},
    create: {
      userId: michael.id,
      year: 2026,
      anstellungPct: 1,
      wochenstunden: 42,
      anzahlVorholtage: 0,
      stundenuebertragAltesJahr: 0,
      ferienuebertragAltesJahr: 0,
      arbeitsmonate: 12,
    },
  });

  for (const tag of juniDaten) {
    const date = new Date(tag.date);
    const entry = await prisma.dailyEntry.upsert({
      where: { userId_date: { userId: michael.id, date } },
      update: {
        krank: tag.krank,
        reisezeit: tag.reisezeit,
        cad: tag.cad,
        ausbildung: tag.ausbildung,
        buero: tag.buero,
        ferien: tag.ferien,
        spesenFr: tag.spesenFr,
        km: tag.km,
        sollOverride: tag.sollOverride,
        start1: tag.stempelzeiten[0]?.start ?? null,
        stop1: tag.stempelzeiten[0]?.stop ?? null,
        start2: tag.stempelzeiten[1]?.start ?? null,
        stop2: tag.stempelzeiten[1]?.stop ?? null,
        start3: tag.stempelzeiten[2]?.start ?? null,
        stop3: tag.stempelzeiten[2]?.stop ?? null,
        start4: tag.stempelzeiten[3]?.start ?? null,
        stop4: tag.stempelzeiten[3]?.stop ?? null,
      },
      create: {
        userId: michael.id,
        date,
        krank: tag.krank,
        reisezeit: tag.reisezeit,
        cad: tag.cad,
        ausbildung: tag.ausbildung,
        buero: tag.buero,
        ferien: tag.ferien,
        spesenFr: tag.spesenFr,
        km: tag.km,
        sollOverride: tag.sollOverride,
        start1: tag.stempelzeiten[0]?.start ?? null,
        stop1: tag.stempelzeiten[0]?.stop ?? null,
        start2: tag.stempelzeiten[1]?.start ?? null,
        stop2: tag.stempelzeiten[1]?.stop ?? null,
        start3: tag.stempelzeiten[2]?.start ?? null,
        stop3: tag.stempelzeiten[2]?.stop ?? null,
        start4: tag.stempelzeiten[3]?.start ?? null,
        stop4: tag.stempelzeiten[3]?.stop ?? null,
      },
    });

    await prisma.booking.deleteMany({ where: { dailyEntryId: entry.id } });
    if (tag.bookings.length > 0) {
      await prisma.booking.createMany({
        data: tag.bookings.map((b) => ({ dailyEntryId: entry.id, label: b.label, hours: b.hours })),
      });
    }
  }

  // Jan-Mai 2026: In der Original-Datei war der Tages-Soll für die Zeit VOR Live-Betrieb des
  // Tools manuell auf 0 überschrieben (siehe CLAUDE.md §7 Punkt 2 / dieselbe Beobachtung für
  // Jun 1.-14.). Für die Demo hier nachgebildet, damit der rollierende Saldo nicht künstlich
  // ins Minus läuft, nur weil vor Juni nichts erfasst wurde.
  const vorMonateCursor = new Date(Date.UTC(2026, 0, 1));
  const stichtag = new Date(Date.UTC(2026, 5, 15)); // 15. Juni 2026
  while (vorMonateCursor < stichtag) {
    const date = new Date(vorMonateCursor);
    await prisma.dailyEntry.upsert({
      where: { userId_date: { userId: michael.id, date } },
      update: {},
      create: { userId: michael.id, date, sollOverride: 0 },
    });
    vorMonateCursor.setUTCDate(vorMonateCursor.getUTCDate() + 1);
  }

  console.log(`Seed fertig: Firma "${company.name}", User "${michael.name}" (${michael.email}) und` +
    ` "${stefan.name}" (Admin), ${feiertage2026.length} Feiertage, ${juniDaten.length} Tageseinträge Juni 2026.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
