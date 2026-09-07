import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  berechneFerienBezogen,
  berechneFerienGuthaben,
  berechneFerienuebertragNaechstesJahr,
  berechneTagesReihe,
  pensumFuerDatum,
  sollProTag,
  sollProTagFuerDatum,
  type DailyEntryInput,
  type Feiertag,
  type PensumPeriode,
  type StempelPaar,
} from "@/lib/calc";
import { EntryForm } from "./EntryForm";

const MONATSNAMEN = [
  "Jan", "Feb", "Mar", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez",
] as const;

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function alleTageImJahr(jahr: number): string[] {
  const tage: string[] = [];
  const cursor = new Date(Date.UTC(jahr, 0, 1));
  while (cursor.getUTCFullYear() === jahr) {
    tage.push(iso(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return tage;
}

function formatStunden(h: number): string {
  return h.toFixed(2).replace(/\.00$/, "");
}

function formatMinuten(min: number | null | undefined): string {
  if (min === null || min === undefined) return "";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Live-Daten aus der DB — nie statisch vorrendern (sonst zeigt die Seite einen eingefrorenen
// Stand vom Build-Zeitpunkt bzw. den letzten Seeding-Stand, siehe CLAUDE.md).
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ userId: string; jahr: string; monat: string }>;
};

export default async function MonatsAnsicht({ params }: Props) {
  const { userId, jahr: jahrStr, monat: monatStr } = await params;
  const jahr = Number(jahrStr);
  const monat = Number(monatStr); // 1-12

  const user = await prisma.user.findUnique({ where: { id: userId }, include: { company: true } });
  if (!user) notFound();

  const session = await auth();
  const binAdmin = (session?.user as { role?: string } | undefined)?.role === "ADMIN";

  const [jahresStammdaten, companySettings, holidaysDb, entriesDb, monatsAbschluss, pensumWechselDb] =
    await Promise.all([
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
      prisma.monthClose.findUnique({
        where: { companyId_year_month: { companyId: user.companyId, year: jahr, month: monat } },
      }),
      prisma.pensumWechsel.findMany({ where: { userId }, orderBy: { gueltigAb: "asc" } }),
    ]);

  // Mitarbeitende dürfen einen abgeschlossenen Monat nicht mehr bearbeiten, Admins schon
  // (siehe CLAUDE.md, Feature "Monatsabschluss" — die Server Action prüft das zusätzlich).
  const istGesperrt = !!monatsAbschluss && !binAdmin;

  if (!jahresStammdaten) {
    return (
      <main>
        <h1>{user.name}</h1>
        <p>Keine Jahres-Stammdaten für {jahr} hinterlegt.</p>
      </main>
    );
  }

  const feiertage: Feiertag[] = holidaysDb.map((h) => ({
    date: iso(h.date),
    label: h.label,
    bezahlt: h.bezahlt,
  }));

  const entriesByDate = new Map(entriesDb.map((e) => [iso(e.date), e]));

  // Pensumwechsel mitten im Jahr (App-eigenes Feature, siehe /admin/pensum): ab `gueltigAb` gilt
  // ein neuer Anstellungsgrad/Wochenstunden-Wert für den Tages-Soll. Basis = die Jahres-
  // Stammdaten (gelten bis zum ersten Wechsel bzw. wenn es keinen gibt).
  const pensumBasis = { anstellungPct: jahresStammdaten.anstellungPct, wochenstunden: jahresStammdaten.wochenstunden };
  const pensumWechsel: PensumPeriode[] = pensumWechselDb.map((w) => ({
    gueltigAb: iso(w.gueltigAb),
    anstellungPct: w.anstellungPct,
    wochenstunden: w.wochenstunden,
  }));
  const sollProTagWertFuerDatum = (date: string) => sollProTagFuerDatum(date, pensumBasis, pensumWechsel);

  // Für die Kopfzeile: das am 1. des angezeigten Monats gültige Pensum.
  const ersterTagMonat = `${jahr}-${String(monat).padStart(2, "0")}-01`;
  const pensumFuerMonat = pensumFuerDatum(ersterTagMonat, pensumBasis, pensumWechsel);
  const sollProTagWert = sollProTag(pensumFuerMonat.wochenstunden, pensumFuerMonat.anstellungPct);

  // Tage vor dem individuellen Startdatum zählen nicht (CLAUDE.md §7 "leere Startphase") — der
  // Override hat Vorrang vor einem evtl. vorhandenen DB-Wert, damit der Saldo bis zum Startdatum
  // exakt beim eingetragenen Anfangswert stehen bleibt.
  const startDatumIso = jahresStammdaten.erfassungStartDatum
    ? iso(jahresStammdaten.erfassungStartDatum)
    : null;

  const alleTage = alleTageImJahr(jahr);
  const entryInputs: DailyEntryInput[] = alleTage.map((date) => {
    const e = entriesByDate.get(date);
    const vorStart = startDatumIso !== null && date < startDatumIso;
    if (!e) {
      const leer: StempelPaar = { start: null, stop: null };
      return {
        date,
        projektStunden: 0,
        krank: 0,
        reisezeit: 0,
        cad: 0,
        ausbildung: 0,
        buero: 0,
        ferien: 0,
        sollOverride: vorStart ? 0 : null,
        stempelzeiten: [leer, leer, leer, leer],
      };
    }
    return {
      date,
      projektStunden: e.bookings.reduce((sum, b) => sum + b.hours, 0),
      krank: e.krank,
      reisezeit: e.reisezeit,
      cad: e.cad,
      ausbildung: e.ausbildung,
      buero: e.buero,
      ferien: e.ferien,
      sollOverride: vorStart ? 0 : e.sollOverride,
      stempelzeiten: [
        { start: e.start1, stop: e.stop1 },
        { start: e.start2, stop: e.stop2 },
        { start: e.start3, stop: e.stop3 },
        { start: e.start4, stop: e.stop4 },
      ],
    };
  });

  const ergebnisse = berechneTagesReihe(
    entryInputs,
    sollProTagWertFuerDatum,
    feiertage,
    jahresStammdaten.stundenuebertragAltesJahr,
  );

  const monatStartIdx = ergebnisse.findIndex((e) => e.date.startsWith(`${jahr}-${String(monat).padStart(2, "0")}`));
  const monatErgebnisse = ergebnisse.filter((e) =>
    e.date.startsWith(`${jahr}-${String(monat).padStart(2, "0")}`),
  );
  const standVorMonat = monatStartIdx > 0 ? ergebnisse[monatStartIdx - 1]!.stand : jahresStammdaten.stundenuebertragAltesJahr;

  // Ferien-Übersicht: immer über das ganze Jahr (siehe CLAUDE.md §2, Ferien-bezogen-Kette).
  const ferienStundenProMonat = Array.from({ length: 12 }, (_, m) =>
    entriesDb
      .filter((e) => e.date.getUTCMonth() === m)
      .reduce((sum, e) => sum + e.ferien, 0),
  );
  const jahresferientage = companySettings?.jahresferientage ?? 0;
  const ferienGuthaben = berechneFerienGuthaben(
    jahresStammdaten.ferienuebertragAltesJahr,
    jahresStammdaten.arbeitsmonate,
    jahresferientage,
  );
  // Pro Monat der jeweils gültige Soll-pro-Tag-Wert (bei einem Pensumwechsel mitten im Jahr
  // unterscheiden sich die Monate vor/nach dem Wechsel, siehe pensum.ts).
  const sollProTagProMonat = Array.from({ length: 12 }, (_, m) =>
    sollProTagWertFuerDatum(`${jahr}-${String(m + 1).padStart(2, "0")}-01`),
  );
  const ferienBezogen = berechneFerienBezogen(ferienStundenProMonat, sollProTagProMonat);
  const ferienUebertrag = berechneFerienuebertragNaechstesJahr(ferienGuthaben, ferienBezogen);

  const entriesByDateFull = entriesByDate; // bookings/labels for display

  return (
    <main>
      <h1>{user.name}</h1>
      <p className="subtitle">
        {user.company.name} — {MONATSNAMEN[monat - 1]} {jahr} — Anstellung{" "}
        {(pensumFuerMonat.anstellungPct * 100).toFixed(0)}%, {pensumFuerMonat.wochenstunden}{" "}
        h/Woche (Soll/Tag {formatStunden(sollProTagWert)} h)
      </p>

      {!startDatumIso && (
        <p className="form-message error" style={{ maxWidth: 520 }}>
          Noch nicht eingerichtet: Ohne Startdatum zählt das Tool ab dem 1. Januar, auch für Tage
          ohne Eintrag. Bitte einmalig unter{" "}
          <Link href="/konto/einrichtung">„Einrichtung“</Link> das Startdatum und den aktuellen
          Stunden-/Ferienstand eintragen.
        </p>
      )}

      <div className="month-nav">
        <a href={`/api/export/${userId}/${jahr}`} className="export-link">
          📥 Excel-Export {jahr}
        </a>
        {(() => {
          const vorMonat = monat === 1 ? { jahr: jahr - 1, monat: 12 } : { jahr, monat: monat - 1 };
          const naechMonat = monat === 12 ? { jahr: jahr + 1, monat: 1 } : { jahr, monat: monat + 1 };
          return (
            <>
              <Link href={`/mitarbeiter/${userId}/${vorMonat.jahr}/${vorMonat.monat}`}>
                ← {MONATSNAMEN[vorMonat.monat - 1]} {vorMonat.jahr}
              </Link>
              <span className="current">
                {MONATSNAMEN[monat - 1]} {jahr}
              </span>
              <Link href={`/mitarbeiter/${userId}/${naechMonat.jahr}/${naechMonat.monat}`}>
                {MONATSNAMEN[naechMonat.monat - 1]} {naechMonat.jahr} →
              </Link>
            </>
          );
        })()}
      </div>

      <div className="card-row">
        <div className="card">
          <div className="label">Stand Vormonat</div>
          <div className="value">{formatStunden(standVorMonat)} h</div>
        </div>
        <div className="card">
          <div className="label">Stand Ende Monat</div>
          <div className="value">
            {formatStunden(monatErgebnisse[monatErgebnisse.length - 1]?.stand ?? standVorMonat)} h
          </div>
        </div>
        <div className="card">
          <div className="label">Ferien Guthaben {jahr}</div>
          <div className="value">{formatStunden(ferienGuthaben)} Tage</div>
        </div>
        <div className="card">
          <div className="label">Ferien bezogen</div>
          <div className="value">{formatStunden(ferienBezogen)} Tage</div>
        </div>
        <div className="card">
          <div className="label">Ferien-Übertrag {jahr + 1}</div>
          <div className="value">{formatStunden(ferienUebertrag)} Tage</div>
        </div>
      </div>

      <h2>Tagesübersicht</h2>
      <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Datum</th>
            <th className="label-cell">Projekte / Kategorien</th>
            <th>Soll</th>
            <th>Ist</th>
            <th>+/-</th>
            <th>Stand</th>
            <th>Stempelzeit</th>
            <th>Kontrolle</th>
          </tr>
        </thead>
        <tbody>
          {monatErgebnisse.map((tag) => {
            const dbEntry = entriesByDateFull.get(tag.date);
            const feiertag = feiertage.find((f) => f.date === tag.date);
            const wochentag = new Date(`${tag.date}T00:00:00Z`).getUTCDay();
            const istWochenende = wochentag === 0 || wochentag === 6;
            const rowClass = feiertag ? "holiday" : istWochenende ? "weekend" : "";
            const buchungen = [
              ...(dbEntry?.bookings.map((b) => `${b.label} ${formatStunden(b.hours)}h`) ?? []),
              dbEntry && dbEntry.krank ? `krank ${formatStunden(dbEntry.krank)}h` : null,
              dbEntry && dbEntry.reisezeit ? `Reisezeit ${formatStunden(dbEntry.reisezeit)}h` : null,
              dbEntry && dbEntry.cad ? `CAD ${formatStunden(dbEntry.cad)}h` : null,
              dbEntry && dbEntry.ausbildung ? `Ausbildung ${formatStunden(dbEntry.ausbildung)}h` : null,
              dbEntry && dbEntry.buero ? `Büro ${formatStunden(dbEntry.buero)}h` : null,
              dbEntry && dbEntry.ferien ? `Ferien ${formatStunden(dbEntry.ferien)}h` : null,
            ].filter(Boolean);

            return (
              <tr key={tag.date} className={rowClass}>
                <td>
                  {tag.date.slice(8, 10)}.{tag.date.slice(5, 7)}.
                  {feiertag ? ` (${feiertag.label.trim()})` : istWochenende ? " (WE)" : ""}
                </td>
                <td className="label-cell">{buchungen.join(", ") || "—"}</td>
                <td className={dbEntry?.sollOverride != null ? "override" : ""}>
                  {formatStunden(tag.soll)}
                </td>
                <td>{formatStunden(tag.ist)}</td>
                <td className={tag.plusMinus > 0 ? "pos" : tag.plusMinus < 0 ? "neg" : ""}>
                  {tag.plusMinus > 0 ? "+" : ""}
                  {formatStunden(tag.plusMinus)}
                </td>
                <td>{formatStunden(tag.stand)}</td>
                <td>
                  {formatMinuten(dbEntry?.start1)}–{formatMinuten(dbEntry?.stop1)}
                  {dbEntry?.start2 != null ? `, ${formatMinuten(dbEntry.start2)}–${formatMinuten(dbEntry.stop2)}` : ""}
                </td>
                <td>{Math.abs(tag.aufteilungIstzeit) > 0.01 ? formatStunden(tag.aufteilungIstzeit) : "✓"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>

      {istGesperrt ? (
        <>
          <h2>Tageseintrag erfassen / bearbeiten</h2>
          <p className="form-message error" style={{ maxWidth: 520 }}>
            🔒 {MONATSNAMEN[monat - 1]} {jahr} ist abgeschlossen (Monatsabschluss) und kann nicht
            mehr bearbeitet werden. Bei Korrekturbedarf bitte an einen Admin wenden.
          </p>
        </>
      ) : (
        <>
          <h2>Tageseintrag erfassen / bearbeiten</h2>
          <EntryForm
            userId={userId}
            jahr={jahr}
            monat={monat}
            defaultDatum={`${jahr}-${String(monat).padStart(2, "0")}-01`}
          />
        </>
      )}
    </main>
  );
}
