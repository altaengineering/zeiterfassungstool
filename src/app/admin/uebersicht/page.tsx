import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { MitarbeiterZeile } from "./MitarbeiterZeile";
import { berechneMonatsStand } from "@/lib/monatsStand";
import { berechneFerienSaldo } from "@/lib/ferienSaldo";
import { vergleicheDienstalter } from "@/lib/dienstalter";
import { ferienAntragAblehnen, ferienAntragGenehmigen } from "./actions";

function fmtDatum(d: Date): string {
  return d.toISOString().slice(8, 10) + "." + d.toISOString().slice(5, 7) + "." + d.toISOString().slice(0, 4);
}

export const dynamic = "force-dynamic";

const MONATSNAMEN = [
  "Jan", "Feb", "Mar", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez",
] as const;

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Arbeitstage (Mo-Fr, ohne bezahlte Feiertage) im Monat bis einschliesslich `bisDatum`, Basis für
// "wer hat diesen Monat noch nichts erfasst" (CLAUDE.md-Backlog). Mit `nurMitEintrag` gezaehlt
// werden nur die dieser Teilmenge an Arbeitstagen, die zusaetzlich einen Eintrag haben, so bleibt
// "erfasste Tage" IMMER eine Teilmenge von "erwartete Arbeitstage" und kann sie nie uebersteigen
// (frueher zaehlte "erfasst" alle DailyEntry-Zeilen des ganzen Monats, auch Wochenenden und Tage
// in der Zukunft, dadurch stand z.B. "30/9" da, was wie ein Fehler aussah).
function arbeitstageBisher(
  jahr: number,
  monat: number,
  bisDatum: Date,
  feiertage: Set<string>,
  nurMitEintrag?: Set<string>,
): number {
  let anzahl = 0;
  const letzterTagMonat = new Date(Date.UTC(jahr, monat, 0)).getUTCDate();
  const bisIso = iso(bisDatum);
  for (let tag = 1; tag <= letzterTagMonat; tag++) {
    const dateStr = `${jahr}-${String(monat).padStart(2, "0")}-${String(tag).padStart(2, "0")}`;
    if (dateStr > bisIso) break;
    const wochentag = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
    if (wochentag === 0 || wochentag === 6) continue;
    if (feiertage.has(dateStr)) continue;
    if (nurMitEintrag && !nurMitEintrag.has(dateStr)) continue;
    anzahl += 1;
  }
  return anzahl;
}

type Props = {
  searchParams: Promise<{ jahr?: string; monat?: string }>;
};

export default async function UebersichtSeite({ searchParams }: Props) {
  const session = await auth();
  const rolle = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || rolle !== "ADMIN") redirect("/");

  const { jahr: jahrParam, monat: monatParam } = await searchParams;
  const heute = new Date();
  const jahr = Number(jahrParam) || heute.getUTCFullYear();
  const monat = Number(monatParam) || heute.getUTCMonth() + 1;

  const userId = (session.user as { id: string }).id;
  const admin = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  const monatStart = new Date(Date.UTC(jahr, monat - 1, 1));
  const monatEnde = new Date(Date.UTC(jahr, monat, 1));

  const [usersDb, feiertageDb, entriesDb] = await Promise.all([
    prisma.user.findMany({ where: { companyId: admin.companyId }, orderBy: { name: "asc" } }),
    prisma.holiday.findMany({
      where: { companyId: admin.companyId, date: { gte: monatStart, lt: monatEnde }, bezahlt: true },
    }),
    prisma.dailyEntry.findMany({
      where: { user: { companyId: admin.companyId }, date: { gte: monatStart, lt: monatEnde } },
      include: { bookings: true, user: true },
      orderBy: { date: "asc" },
    }),
  ]);

  // Nach Dienstalter statt Namen, siehe src/lib/dienstalter.ts, auch hier zuerst am Firmenumfeld
  // orientiert (aelteste zuerst), wie ausdruecklich gewuenscht.
  const users = [...usersDb].sort(vergleicheDienstalter);

  const feiertage = new Set(feiertageDb.map((f) => iso(f.date)));
  const istAktuellerMonat = jahr === heute.getUTCFullYear() && monat === heute.getUTCMonth() + 1;
  const stichtag = istAktuellerMonat ? heute : monatEnde;
  const stichtagBisGestern = new Date(stichtag.getTime() - 86400000);
  const erwarteteArbeitstage = arbeitstageBisher(jahr, monat, stichtagBisGestern, feiertage);

  const entriesByUser = new Map<string, typeof entriesDb>();
  for (const e of entriesDb) {
    const liste = entriesByUser.get(e.userId) ?? [];
    liste.push(e);
    entriesByUser.set(e.userId, liste);
  }

  const vorMonat = monat === 1 ? { jahr: jahr - 1, monat: 12 } : { jahr, monat: monat - 1 };
  const naechMonat = monat === 12 ? { jahr: jahr + 1, monat: 1 } : { jahr, monat: monat + 1 };

  function erfassteArbeitstage(userId: string): number {
    const entryDatesSet = new Set((entriesByUser.get(userId) ?? []).map((e) => iso(e.date)));
    return arbeitstageBisher(jahr, monat, stichtagBisGestern, feiertage, entryDatesSet);
  }

  const anzahlImRueckstand = users.filter(
    (u) => erfassteArbeitstage(u.id) < erwarteteArbeitstage,
  ).length;

  // Gleitzeitstand pro Person, parallel berechnet (jede Berechnung braucht die volle Jahresreihe
  // dieser Person, siehe berechneMonatsStand). Nur fuer Admins, daher hier der Mehraufwand okay.
  // Mit nichtInDieZukunftProjizieren: der Stand hier ist ein "wo stehen wir heute"-Blick, nicht
  // der rollierende Saldo aus dem echten Rapport (der zaehlt noch nicht erfasste Resttage des
  // Monats bewusst als offen) - siehe Kommentar in monatsStand.ts.
  const standByUser = new Map(
    await Promise.all(
      users.map(
        async (u) =>
          [u.id, await berechneMonatsStand(u.id, jahr, monat, { nichtInDieZukunftProjizieren: true })] as const,
      ),
    ),
  );

  // Ferien-Saldo immer fuers laufende Kalenderjahr, unabhaengig vom Monat, den man sich in der
  // Uebersicht gerade ansieht (Ferienplanung ist ein Jetzt-Blick, kein Monatsrueckblick wie der
  // Rest der Seite) — siehe user-Anfrage "Chefübersicht braucht mehr Infos und Daten".
  const heuteJahr = heute.getUTCFullYear();
  const saldoByUser = new Map(
    await Promise.all(users.map(async (u) => [u.id, await berechneFerienSaldo(u.id, heuteJahr)] as const)),
  );

  const offeneFerienantraege = await prisma.ferienAntrag.findMany({
    where: { user: { companyId: admin.companyId }, status: "offen" },
    include: { user: true },
    orderBy: { erstelltAm: "asc" },
  });

  return (
    <main>
      <h1>Chef-Übersicht</h1>
      <p className="subtitle">
        Wer hat an welchen Projekten gearbeitet, mit welchem Kommentar, und wer hinkt bei der
        Erfassung hinterher. Zeile anklicken zum Aufklappen. Nur für Admins sichtbar.
      </p>

      <div className="month-nav">
        <Link href={`/admin/uebersicht?jahr=${vorMonat.jahr}&monat=${vorMonat.monat}`}>
          ← {MONATSNAMEN[vorMonat.monat - 1]} {vorMonat.jahr}
        </Link>
        <span className="current">
          {MONATSNAMEN[monat - 1]} {jahr}
        </span>
        <Link href={`/admin/uebersicht?jahr=${naechMonat.jahr}&monat=${naechMonat.monat}`}>
          {MONATSNAMEN[naechMonat.monat - 1]} {naechMonat.jahr} →
        </Link>
      </div>

      <div className="card-row">
        <div className="card card-accent card-accent-blau">
          <div className="label">Mitarbeitende</div>
          <div className="value">{users.length}</div>
        </div>
        <div className="card card-accent card-accent-blau">
          <div className="label">Erwartete Arbeitstage bisher</div>
          <div className="value">{erwarteteArbeitstage}</div>
        </div>
        <div className="card card-accent card-accent-rot">
          <div className="label">Im Rückstand</div>
          <div className={"value" + (anzahlImRueckstand > 0 ? " neg" : "")}>{anzahlImRueckstand}</div>
        </div>
        <div className={"card card-accent" + (offeneFerienantraege.length > 0 ? " card-accent-rot" : " card-accent-blau")}>
          <div className="label">Offene Ferienanträge</div>
          <div className={"value" + (offeneFerienantraege.length > 0 ? " neg" : "")}>
            {offeneFerienantraege.length}
          </div>
        </div>
      </div>

      {offeneFerienantraege.length > 0 && (
        <>
          <h2>Offene Ferienanträge</h2>
          <div className="ferien-antraege-liste" style={{ marginBottom: 28 }}>
            {offeneFerienantraege.map((a) => {
              const saldo = saldoByUser.get(a.userId);
              return (
                <div key={a.id} className="ferien-antrag-zeile">
                  <div className="ferien-antrag-info">
                    <span>
                      <strong>{a.user.name}</strong>: {fmtDatum(a.von)} – {fmtDatum(a.bis)} (
                      {a.arbeitstage} {a.arbeitstage === 1 ? "Arbeitstag" : "Arbeitstage"})
                      {saldo && (
                        <>
                          {" "}
                          · Saldo aktuell:{" "}
                          <span className={saldo.ferienUebertrag < 0 ? "neg" : "pos"}>
                            {saldo.ferienUebertrag.toFixed(1)} Tage
                          </span>
                        </>
                      )}
                    </span>
                    {a.kommentar && <span className="ferien-antrag-kommentar">{a.kommentar}</span>}
                  </div>
                  <div className="ferien-antrag-aktionen">
                    <form action={ferienAntragGenehmigen}>
                      <input type="hidden" name="antragId" value={a.id} />
                      <button type="submit">Genehmigen</button>
                    </form>
                    <form action={ferienAntragAblehnen}>
                      <input type="hidden" name="antragId" value={a.id} />
                      <button type="submit" className="link-btn-inline">
                        Ablehnen
                      </button>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="table-wrap">
        <table className="uebersicht-table">
          <thead>
            <tr>
              <th className="label-cell">Mitarbeiter</th>
              <th>Tage erfasst</th>
              <th className="label-cell">Status</th>
              <th
                className="label-cell"
                title="Stand von gestern: heute und noch nicht erfasste Resttage dieses Monats zaehlen nicht mit"
              >
                Gleitzeit (Stand gestern)
              </th>
              <th title={`Ferien-Saldo für ${heuteJahr}, unabhängig vom oben gewählten Monat`}>
                Ferien übrig
              </th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const entries = entriesByUser.get(u.id) ?? [];
              const erfassteTage = erfassteArbeitstage(u.id);
              const hinterher = erfassteTage < erwarteteArbeitstage;
              const zeilen = entries.flatMap((e) =>
                e.bookings.length > 0
                  ? e.bookings.map((b) => ({
                      datum: iso(e.date),
                      label: b.label,
                      hours: b.hours,
                      kommentar: b.kommentar,
                    }))
                  : [{ datum: iso(e.date), label: "—", hours: 0, kommentar: "" }],
              );

              const stand = standByUser.get(u.id) ?? null;
              const saldo = saldoByUser.get(u.id) ?? null;

              return (
                <MitarbeiterZeile
                  key={u.id}
                  userId={u.id}
                  jahr={jahr}
                  monat={monat}
                  name={u.name}
                  erfassteTage={erfassteTage}
                  erwarteteArbeitstage={erwarteteArbeitstage}
                  hinterher={hinterher}
                  zeilen={zeilen}
                  standEndeMonat={stand?.standEndeMonat ?? null}
                  standVeraenderung={stand ? stand.standEndeMonat - stand.standVorMonat : null}
                  ferienUebertrag={saldo?.ferienUebertrag ?? null}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
