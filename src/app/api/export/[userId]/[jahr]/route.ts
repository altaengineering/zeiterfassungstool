import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { erzeugeExcelExport, EXPORT_TEMPLATE_JAHR, type ExportTag } from "@/lib/export/exportExcel";

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ userId: string; jahr: string }> },
) {
  const { userId, jahr: jahrStr } = await params;
  const jahr = Number(jahrStr);

  if (jahr !== EXPORT_TEMPLATE_JAHR) {
    return NextResponse.json(
      {
        error: `Export aktuell nur für ${EXPORT_TEMPLATE_JAHR} unterstützt (Vorlage hat feste Zeilenzahl pro Monat, siehe CLAUDE.md §6).`,
      },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, include: { company: true } });
  if (!user) {
    return NextResponse.json({ error: "User nicht gefunden" }, { status: 404 });
  }

  const [jahresStammdaten, companySettings, holidaysDb, entriesDb] = await Promise.all([
    prisma.jahresStammdaten.findUnique({ where: { userId_year: { userId, year: jahr } } }),
    prisma.companySettings.findUnique({
      where: { companyId_year: { companyId: user.companyId, year: jahr } },
    }),
    prisma.holiday.findMany({
      where: {
        companyId: user.companyId,
        date: { gte: new Date(Date.UTC(jahr, 0, 1)), lt: new Date(Date.UTC(jahr + 1, 0, 1)) },
      },
    }),
    prisma.dailyEntry.findMany({
      where: {
        userId,
        date: { gte: new Date(Date.UTC(jahr, 0, 1)), lt: new Date(Date.UTC(jahr + 1, 0, 1)) },
      },
      include: { bookings: true },
    }),
  ]);

  if (!jahresStammdaten) {
    return NextResponse.json({ error: "Jahres-Stammdaten nicht gefunden" }, { status: 404 });
  }

  const tage: ExportTag[] = entriesDb.map((e) => ({
    date: iso(e.date),
    bookings: e.bookings.map((b) => ({ label: b.label, hours: b.hours })),
    krank: e.krank,
    reisezeit: e.reisezeit,
    cad: e.cad,
    ausbildung: e.ausbildung,
    buero: e.buero,
    ferien: e.ferien,
    spesenFr: e.spesenFr,
    km: e.km,
    sollOverride: e.sollOverride,
    stempelzeiten: [
      { start: e.start1, stop: e.stop1 },
      { start: e.start2, stop: e.stop2 },
      { start: e.start3, stop: e.stop3 },
      { start: e.start4, stop: e.stop4 },
    ],
  }));

  const buffer = await erzeugeExcelExport({
    companyName: user.company.name,
    userName: user.name,
    jahr,
    anstellungPct: jahresStammdaten.anstellungPct,
    wochenstunden: jahresStammdaten.wochenstunden,
    anzahlVorholtage: jahresStammdaten.anzahlVorholtage,
    stundenuebertragAltesJahr: jahresStammdaten.stundenuebertragAltesJahr,
    ferienuebertragAltesJahr: jahresStammdaten.ferienuebertragAltesJahr,
    arbeitsmonate: jahresStammdaten.arbeitsmonate,
    kmSpesensatz: companySettings?.kmSpesensatz ?? 0,
    ferienBezogenBisher: 0,
    feiertage: holidaysDb.map((h) => ({ date: iso(h.date), label: h.label, bezahlt: h.bezahlt })),
    tage,
  });

  const dateisicherName = `Arbeitsrapport_${jahr}_${user.name.replace(/\s+/g, "_")}.xlsx`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${dateisicherName}"`,
    },
  });
}
