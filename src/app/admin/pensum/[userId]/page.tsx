import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { berechneMonatsStand } from "@/lib/monatsStand";
import {
  berechneFerienBezogen,
  berechneFerienBezogenGesamt,
  berechneFerienGuthaben,
  berechneFerienuebertragNaechstesJahr,
  sollProTag,
  STANDARD_JAHRESFERIENTAGE,
} from "@/lib/calc";
import {
  pensumWechselHinzufuegen,
  pensumWechselLoeschen,
  stammdatenKorrigieren,
  stundenAuszahlen,
  ferientageAuszahlen,
  gleitzeitStandSetzen,
} from "./actions";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ userId: string }>;
};

export default async function PensumSeite({ params }: Props) {
  const session = await auth();
  const rolle = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || rolle !== "ADMIN") redirect("/");

  const { userId } = await params;
  const heute = new Date();
  const jahr = heute.getFullYear();
  const monat = heute.getMonth() + 1;

  const [user, jahresStammdaten, wechselListe] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.jahresStammdaten.findUnique({ where: { userId_year: { userId, year: jahr } } }),
    prisma.pensumWechsel.findMany({ where: { userId }, orderBy: { gueltigAb: "asc" } }),
  ]);
  if (!user) redirect("/admin");

  // Live-Werte fuer die Admin-Korrektur-Karte: damit man beim Beheben eines gemeldeten Problems
  // sofort sieht, wo die Person aktuell steht, statt die Zahlen zuerst selbst nachrechnen zu
  // muessen. Dieselben Berechnungsfunktionen wie auf der Chef-Uebersicht bzw. der persoenlichen
  // Monatsseite, hier nur auf die reinen Zahlen reduziert.
  let aktuellerStand: number | null = null;
  let ferienGuthaben: number | null = null;
  let ferienBezogen: number | null = null;
  let ferienUebertrag: number | null = null;

  const companySettings = await prisma.companySettings.findUnique({
    where: { companyId_year: { companyId: user.companyId, year: jahr } },
  });
  const standardJahresferientage = companySettings?.jahresferientage ?? STANDARD_JAHRESFERIENTAGE;

  if (jahresStammdaten) {
    const [standErgebnis, entriesDb] = await Promise.all([
      berechneMonatsStand(userId, jahr, monat, { nichtInDieZukunftProjizieren: true }),
      prisma.dailyEntry.findMany({
        where: { userId, date: { gte: new Date(Date.UTC(jahr, 0, 1)), lt: new Date(Date.UTC(jahr + 1, 0, 1)) } },
      }),
    ]);

    aktuellerStand = standErgebnis?.standEndeMonat ?? null;

    const jahresferientageEffektiv = jahresStammdaten.jahresferientage ?? standardJahresferientage;
    ferienGuthaben = berechneFerienGuthaben(
      jahresStammdaten.ferienuebertragAltesJahr,
      jahresStammdaten.arbeitsmonate,
      jahresferientageEffektiv,
    );
    const ferienStundenProMonat = Array.from({ length: 12 }, (_, m) =>
      entriesDb.filter((e) => e.date.getUTCMonth() === m).reduce((sum, e) => sum + e.ferien, 0),
    );
    const sollProTagWert = sollProTag(jahresStammdaten.wochenstunden, jahresStammdaten.anstellungPct);
    ferienBezogen = berechneFerienBezogenGesamt(
      berechneFerienBezogen(ferienStundenProMonat, sollProTagWert),
      jahresStammdaten.ferienBezogenKorrektur,
    );
    ferienUebertrag = berechneFerienuebertragNaechstesJahr(ferienGuthaben, ferienBezogen);
  }

  return (
    <main>
      <h1>Pensum – {user.name}</h1>
      <p className="subtitle">
        Basiswert für {jahr} laut Nutzerverwaltung: {jahresStammdaten ? `${(jahresStammdaten.anstellungPct * 100).toFixed(0)}%, ${jahresStammdaten.wochenstunden} h/Woche` : "keine Jahres-Stammdaten hinterlegt"}.
        Ändert sich das Pensum mitten im Jahr, hier einen Wechsel mit Datum eintragen — ab diesem
        Tag rechnet das Tool automatisch mit dem neuen Wert, alle Tage davor bleiben beim
        bisherigen Wert. <Link href="/admin">← zurück zur Nutzerverwaltung</Link>
      </p>

      <div className="entry-form-card" style={{ marginBottom: 24 }}>
        <h2 style={{ marginTop: 0 }}>Gleitzeit und Ferien korrigieren</h2>
        <p className="subtitle">
          Für direkte Korrekturen, wenn jemand ein falsches Guthaben meldet, ohne Umweg über die
          Person selbst. Aktueller Stand laut den hinterlegten Werten:
        </p>
        {jahresStammdaten ? (
          <div className="card-row" style={{ marginBottom: 16 }}>
            <div className="card card-accent card-accent-blau">
              <div className="label">Gleitzeit-Stand (aktuell)</div>
              <div className={"value" + (aktuellerStand != null && aktuellerStand < 0 ? " neg" : "")}>
                {aktuellerStand != null ? `${aktuellerStand.toFixed(2)} h` : "–"}
              </div>
            </div>
            <div className="card card-accent card-accent-blau">
              <div className="label">Ferien Guthaben {jahr}</div>
              <div className="value">{ferienGuthaben != null ? `${ferienGuthaben.toFixed(1)} Tage` : "–"}</div>
            </div>
            <div className="card card-accent card-accent-blau">
              <div className="label">Ferien bezogen</div>
              <div className="value">{ferienBezogen != null ? `${ferienBezogen.toFixed(1)} Tage` : "–"}</div>
            </div>
            <div className="card card-accent card-accent-blau">
              <div className="label">Ferienübertrag {jahr + 1}</div>
              <div className="value">{ferienUebertrag != null ? `${ferienUebertrag.toFixed(1)} Tage` : "–"}</div>
            </div>
          </div>
        ) : (
          <p className="form-message small">Keine Jahres-Stammdaten für {jahr} hinterlegt.</p>
        )}

        {jahresStammdaten && (
          <form action={gleitzeitStandSetzen} className="entry-form" style={{ marginBottom: 20 }}>
            <input type="hidden" name="userId" value={userId} />
            <input type="hidden" name="jahr" value={jahr} />
            <label>
              Gleitzeit-Stand auf diesen Wert setzen (Stunden, Stand bis gestern)
              <input
                type="number"
                name="ziel"
                step={0.01}
                placeholder={aktuellerStand != null ? `aktuell ${aktuellerStand.toFixed(2)}` : "z.B. -12.5"}
                required
              />
            </label>
            <p className="form-message small" style={{ margin: "4px 0 10px" }}>
              Du gibst den Gleitzeit-Stand ein, der stimmen soll. Das Tool rechnet den Startwert (1. Januar)
              selbst so um, dass die Karte oben, die Monatsseite und der Excel-Export genau diesen Wert
              zeigen. Der Stand zählt bis gestern, mit dem Startdatum der Person.
            </p>
            <div className="entry-form-footer" style={{ marginTop: 0 }}>
              <button type="submit">Stand setzen</button>
            </div>
          </form>
        )}

        {jahresStammdaten && (
          <div className="form-row-pair" style={{ marginBottom: 20 }}>
            <form action={stundenAuszahlen} className="entry-form" style={{ margin: 0 }}>
              <input type="hidden" name="userId" value={userId} />
              <input type="hidden" name="jahr" value={jahr} />
              <label>
                Gleitzeit auszahlen (Stunden)
                <input type="number" name="stunden" step={0.1} placeholder="z.B. 5" />
              </label>
              <p className="form-message small" style={{ margin: "4px 0 10px" }}>
                Wird direkt vom Gleitzeit-Stand oben abgezogen. Negative Zahl eintippen, um
                stattdessen gutzuschreiben.
              </p>
              <div className="entry-form-footer" style={{ marginTop: 0 }}>
                <button type="submit">Abziehen</button>
              </div>
            </form>
            <form action={ferientageAuszahlen} className="entry-form" style={{ margin: 0 }}>
              <input type="hidden" name="userId" value={userId} />
              <input type="hidden" name="jahr" value={jahr} />
              <label>
                Ferientage auszahlen (Tage)
                <input type="number" name="tage" step={0.5} placeholder="z.B. 5" />
              </label>
              <p className="form-message small" style={{ margin: "4px 0 10px" }}>
                Wird direkt von "Ferien, die noch da sind" oben abgezogen. Negative Zahl eintippen,
                um stattdessen gutzuschreiben.
              </p>
              <div className="entry-form-footer" style={{ marginTop: 0 }}>
                <button type="submit">Abziehen</button>
              </div>
            </form>
          </div>
        )}

        <p className="subtitle">
          Direkt editierbar sind die Grundwerte, aus denen sich die Zahlen oben berechnen (für
          Spezialfälle, im Alltag reichen die beiden Schnellkorrekturen oben). Es gibt keinen
          einzelnen "Gleitzeit-Stand heute"-Wert zum Überschreiben, der Stand ist immer die Summe
          aus dem Startwert unten plus allen Tageseinträgen seither, daher hier den Startwert
          anpassen, bis der Stand oben stimmt (Seite danach neu laden, um das Ergebnis zu sehen).
        </p>
        <form action={stammdatenKorrigieren} className="entry-form">
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="jahr" value={jahr} />
          <div className="form-row-pair">
            <label>
              Stundenübertrag Vorjahr (Startwert 1. Januar)
              <input
                type="number"
                name="stundenuebertragAltesJahr"
                step={0.01}
                defaultValue={jahresStammdaten?.stundenuebertragAltesJahr ?? 0}
              />
            </label>
            <label>
              Ferienübertrag Vorjahr (Tage)
              <input
                type="number"
                name="ferienuebertragAltesJahr"
                step={0.1}
                defaultValue={jahresStammdaten?.ferienuebertragAltesJahr ?? 0}
              />
            </label>
          </div>
          <label>
            Ferientage pro Jahr laut Vertrag (leer = Firmenstandard)
            <input
              type="number"
              name="jahresferientage"
              step={0.1}
              defaultValue={jahresStammdaten?.jahresferientage ?? ""}
              placeholder={`Standard: ${standardJahresferientage.toFixed(1)} Tage/Jahr`}
            />
          </label>
          <label>
            Zusätzlich verbrauchte Ferientage, nicht in Tageseinträgen erfasst
            <input
              type="number"
              name="ferienBezogenKorrektur"
              step={0.1}
              defaultValue={jahresStammdaten?.ferienBezogenKorrektur ?? 0}
            />
          </label>
          <p className="form-message small">
            Für Ferientage, die genommen, aber nie im Kalender als Ferien-Tag erfasst wurden (siehe
            "Ferien bezogen" oben). Wird zur aus echten Tageseinträgen berechneten Anzahl
            hinzugezählt, nicht ersetzt, künftige echte Einträge zählen also weiterhin normal dazu.
          </p>
          <div className="entry-form-footer">
            <button type="submit" disabled={!jahresStammdaten}>
              Korrektur speichern
            </button>
          </div>
        </form>
      </div>

      <div className="entry-form-card" style={{ marginBottom: 24 }}>
        <form action={pensumWechselHinzufuegen} className="entry-form">
          <input type="hidden" name="userId" value={userId} />
          <div className="form-row-pair">
            <label>
              Gültig ab
              <input type="date" name="gueltigAb" required />
            </label>
            <label>
              Anstellung %
              <input type="number" name="anstellungPct" min={1} max={100} step={1} defaultValue={100} required />
            </label>
            <label>
              Wochenstunden
              <input type="number" name="wochenstunden" min={1} step={0.5} defaultValue={42} required />
            </label>
          </div>
          <div className="entry-form-footer">
            <button type="submit">Pensumwechsel speichern</button>
          </div>
        </form>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Gültig ab</th>
              <th className="label-cell">Anstellung %</th>
              <th className="label-cell">Wochenstunden</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {wechselListe.length === 0 && (
              <tr>
                <td className="label-cell" colSpan={4}>
                  Noch kein Pensumwechsel hinterlegt.
                </td>
              </tr>
            )}
            {wechselListe.map((w) => (
              <tr key={w.id}>
                <td className="label-cell">{w.gueltigAb.toISOString().slice(0, 10)}</td>
                <td className="label-cell">{(w.anstellungPct * 100).toFixed(0)}%</td>
                <td className="label-cell">{w.wochenstunden}</td>
                <td className="label-cell">
                  <form action={pensumWechselLoeschen}>
                    <input type="hidden" name="id" value={w.id} />
                    <input type="hidden" name="userId" value={userId} />
                    <button type="submit" className="link-btn-inline">
                      löschen
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
