import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { STANDARD_JAHRESFERIENTAGE } from "../src/lib/calc";
import feiertage2026 from "./seed-data/feiertage-2026.json";
import juniDaten from "./seed-data/jun-2026-michael-kueng.json";
import juliDaten from "./seed-data/jul-2026-michael-kueng.json";
import augustDaten from "./seed-data/aug-2026-michael-kueng.json";
import septemberDaten from "./seed-data/sep-2026-michael-kueng.json";

const prisma = new PrismaClient();

interface MitarbeiterSeed {
  name: string;
  pct: number;
  rolle: "ADMIN" | "MITARBEITER";
  email: string;
  pw: string;
}

// Enthält Klartext-Initialpasswörter, siehe .gitignore (prisma/seed-data/*.local.json) — nie
// committen. Datei manuell neben diesem Skript ablegen (Format: siehe MitarbeiterSeed).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mitarbeitendePath = path.join(__dirname, "seed-data/mitarbeitende-2026.local.json");
const mitarbeitende: MitarbeiterSeed[] = JSON.parse(readFileSync(mitarbeitendePath, "utf-8"));

interface TagesDaten {
  date: string;
  bookings: { label: string; hours: number }[];
  krank: number;
  reisezeit: number;
  cad: number;
  ausbildung: number;
  buero: number;
  ferien: number;
  sollOverride: number | null;
  spesenFr: number;
  km: number;
  stempelzeiten: Array<{ start: number | null; stop: number | null }>;
}

async function seedTag(userId: string, tag: TagesDaten) {
  const date = new Date(tag.date);
  const felder = {
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
  };

  const entry = await prisma.dailyEntry.upsert({
    where: { userId_date: { userId, date } },
    update: felder,
    create: { userId, date, ...felder },
  });

  await prisma.booking.deleteMany({ where: { dailyEntryId: entry.id } });
  if (tag.bookings.length > 0) {
    await prisma.booking.createMany({
      data: tag.bookings.map((b) => ({ dailyEntryId: entry.id, label: b.label, hours: b.hours })),
    });
  }
}

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

  // Reale Firmen-Belegschaft (14 Personen, siehe CLAUDE.md §5). Passwörter kommen aus der
  // lokalen, nicht committeten JSON-Datei; werden hier gehasht und bei jedem Seed-Lauf auf den
  // (dort hinterlegten) Ausgangswert zurückgesetzt — bewusst so, damit ein erneuter Seed-Lauf als
  // "Passwort zurücksetzen"-Mechanismus dient, solange kein Self-Service-Reset existiert.
  for (const m of mitarbeitende) {
    const passwordHash = await bcrypt.hash(m.pw, 10);
    const user = await prisma.user.upsert({
      where: { email: m.email },
      update: { name: m.name, role: m.rolle, passwordHash },
      create: {
        companyId: company.id,
        name: m.name,
        email: m.email,
        passwordHash,
        role: m.rolle,
      },
    });

    await prisma.jahresStammdaten.upsert({
      where: { userId_year: { userId: user.id, year: 2026 } },
      update: {},
      create: {
        userId: user.id,
        year: 2026,
        anstellungPct: m.pct,
        wochenstunden: 42,
        anzahlVorholtage: 0,
        stundenuebertragAltesJahr: 0,
        ferienuebertragAltesJahr: 0,
        arbeitsmonate: 12,
      },
    });
  }

  const michael = await prisma.user.findUniqueOrThrow({
    where: { email: "m.kueng@alta-engineering.ch" },
  });

  // Reale Daten aus Arbeitsrapport_2026_kum.xlsx, direkt aus der Datei extrahiert (siehe
  // prisma/seed-data/*.json). Für Aug 24./25./26./27./31. wurde real gestempelt, aber keinem
  // Projekt zugeordnet (Original-Excel-Bug, führte zu falschem Gleitzeit-Stand) — auf Rückfrage
  // vom Nutzer bestätigt: diese Stunden zählen als "Webprojekt". Der 28.08. war komplett leer
  // (weder gestempelt noch gebucht) — auf Rückfrage als Ferientag erfasst.
  const alleMonatsDaten: TagesDaten[] = [
    ...juniDaten,
    ...juliDaten,
    ...augustDaten,
    ...septemberDaten,
  ] as TagesDaten[];

  for (const tag of alleMonatsDaten) {
    await seedTag(michael.id, tag);
  }

  // Jan-Mai 2026: In der Original-Datei war der Tages-Soll für die Zeit VOR Live-Betrieb des
  // Tools manuell auf 0 überschrieben (siehe CLAUDE.md §7 Punkt 2). Für die Demo hier
  // nachgebildet, damit der rollierende Saldo nicht künstlich ins Minus läuft, nur weil vor Juni
  // nichts erfasst wurde. Ab Juni sind reale Daten (inkl. eigener sollOverride=0-Tage) vorhanden.
  const vorMonateCursor = new Date(Date.UTC(2026, 0, 1));
  const stichtag = new Date(Date.UTC(2026, 5, 1)); // 1. Juni 2026
  while (vorMonateCursor < stichtag) {
    const date = new Date(vorMonateCursor);
    await prisma.dailyEntry.upsert({
      where: { userId_date: { userId: michael.id, date } },
      update: {},
      create: { userId: michael.id, date, sollOverride: 0 },
    });
    vorMonateCursor.setUTCDate(vorMonateCursor.getUTCDate() + 1);
  }

  console.log(
    `Seed fertig: Firma "${company.name}", ${mitarbeitende.length} Mitarbeitende angelegt/` +
      `aktualisiert, ${feiertage2026.length} Feiertage, ${alleMonatsDaten.length} Tageseinträge ` +
      `Jun-Sep 2026 für ${michael.name}.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
