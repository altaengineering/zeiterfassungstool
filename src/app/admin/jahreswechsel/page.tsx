import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { berechneUebernahme, feiertageVorschlag } from "@/lib/jahreswechsel";
import { jahrVorbereiten, feiertageUebernehmen, uebertragNeuRechnen } from "./actions";

export const dynamic = "force-dynamic";

const fmt = (n: number) => n.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const datumCH = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

export default async function JahreswechselSeite({
  searchParams,
}: {
  searchParams: Promise<{ jahr?: string }>;
}) {
  const session = await auth();
  const rolle = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || rolle !== "ADMIN") redirect("/");

  const heute = new Date();
  const aktuellesJahr = heute.getUTCFullYear();
  const { jahr: jahrParam } = await searchParams;
  const parsed = Number(jahrParam);
  // Vorgabe: im Dezember das nächste Jahr (Vorbereitung), sonst das laufende Jahr (Kontrolle).
  const vorgabe = heute.getUTCMonth() === 11 ? aktuellesJahr + 1 : aktuellesJahr;
  const jahr = Number.isInteger(parsed) && parsed >= 2001 && parsed <= 2100 ? parsed : vorgabe;
  const vorjahr = jahr - 1;

  const adminId = (session.user as { id: string }).id;
  const admin = await prisma.user.findUniqueOrThrow({ where: { id: adminId } });
  const users = await prisma.user.findMany({ where: { companyId: admin.companyId }, orderBy: { name: "asc" } });

  const zeilen = [];
  for (const u of users) {
    const [vorhanden, uebernahme] = await Promise.all([
      prisma.jahresStammdaten.findUnique({ where: { userId_year: { userId: u.id, year: jahr } } }),
      berechneUebernahme(u.id, vorjahr),
    ]);
    zeilen.push({ u, vorhanden, uebernahme });
  }
  const fehlend = zeilen.filter((z) => !z.vorhanden && z.uebernahme).length;
  const ohneVorjahr = zeilen.filter((z) => !z.vorhanden && !z.uebernahme);
  const vorschlag = await feiertageVorschlag(admin.companyId, jahr);

  const vorjahrNochNichtVorbei = vorjahr >= aktuellesJahr;
  const zukunft = jahr > aktuellesJahr;

  return (
    <main>
      <h1>Jahreswechsel {jahr}</h1>
      <p className="subtitle">
        Zum Jahresbeginn braucht jede Person Jahresdaten (Pensum, Übertrag aus {vorjahr}, Ferienanspruch) und die
        Firma die Feiertage. Hier werden beide aus dem Vorjahr übernommen und geprüft.
      </p>

      <p>
        {[jahr - 1, jahr, jahr + 1].map((j) => (
          <a key={j} href={`/admin/jahreswechsel?jahr=${j}`} style={{ marginRight: 12, fontWeight: j === jahr ? 700 : 400 }}>
            {j}
          </a>
        ))}
      </p>

      {vorjahrNochNichtVorbei && (
        <div className="entry-form-card" style={{ marginBottom: 16 }}>
          <strong>{vorjahr} ist noch nicht abgeschlossen.</strong> Ein jetzt berechneter Übertrag stimmt nur, wenn
          alle Einträge bis zum 31.12. erfasst sind. Nach dem Jahresende genügt »Übertrag neu berechnen«.
        </div>
      )}

      <h2>1. Feiertage {jahr}</h2>
      {vorschlag.length === 0 ? (
        <p>Alle Feiertage aus {vorjahr} sind für {jahr} bereits vorhanden.</p>
      ) : (
        <>
          <p>
            Aus {vorjahr} übernommen, bewegliche Feiertage (Karfreitag, Ostermontag, Auffahrt, Pfingstmontag,
            Fronleichnam) aus Ostern berechnet. Bitte kurz prüfen.
          </p>
          <div className="table-wrap" style={{ marginBottom: 12 }}>
            <table>
              <thead>
                <tr>
                  <th>Datum</th>
                  <th className="label-cell">Bezeichnung</th>
                  <th className="label-cell">Bezahlt</th>
                </tr>
              </thead>
              <tbody>
                {vorschlag.map((f) => (
                  <tr key={f.date}>
                    <td className="label-cell">{datumCH(f.date)}</td>
                    <td className="label-cell">{f.label}</td>
                    <td className="label-cell">{f.bezahlt ? "ja" : "nein"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <form action={feiertageUebernehmen}>
            <input type="hidden" name="jahr" value={jahr} />
            <button type="submit">{vorschlag.length} Feiertage für {jahr} anlegen</button>
          </form>
        </>
      )}

      <h2 style={{ marginTop: 32 }}>2. Jahresdaten der Mitarbeitenden</h2>
      <div className="table-wrap" style={{ marginBottom: 12 }}>
        <table>
          <thead>
            <tr>
              <th className="label-cell">Person</th>
              <th className="label-cell">Jahresdaten {jahr}</th>
              <th>Gleitzeit 31.12.{vorjahr}</th>
              <th>Ferienrest 31.12.{vorjahr}</th>
              <th>Übertrag gespeichert</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {zeilen.map(({ u, vorhanden, uebernahme }) => {
              const abweichend =
                vorhanden &&
                uebernahme &&
                (Math.abs(vorhanden.stundenuebertragAltesJahr - uebernahme.stundenuebertrag) > 0.01 ||
                  Math.abs(vorhanden.ferienuebertragAltesJahr - uebernahme.ferienuebertrag) > 0.01);
              return (
                <tr key={u.id}>
                  <td className="label-cell">{u.name}</td>
                  <td className="label-cell">{vorhanden ? "vorhanden" : uebernahme ? "fehlt" : "fehlt, kein Vorjahr"}</td>
                  <td>{uebernahme ? `${fmt(uebernahme.stundenuebertrag)} h` : "–"}</td>
                  <td>{uebernahme ? `${fmt(uebernahme.ferienuebertrag)} Tage` : "–"}</td>
                  <td>
                    {vorhanden
                      ? `${fmt(vorhanden.stundenuebertragAltesJahr)} h / ${fmt(vorhanden.ferienuebertragAltesJahr)} Tage`
                      : "–"}
                  </td>
                  <td className="label-cell">
                    {abweichend && (
                      <form action={uebertragNeuRechnen}>
                        <input type="hidden" name="jahr" value={jahr} />
                        <input type="hidden" name="userId" value={u.id} />
                        <button type="submit" className="link-btn-inline">
                          Übertrag neu berechnen
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {ohneVorjahr.length > 0 && (
        <p>
          Ohne Daten aus {vorjahr} (z.B. neu eingetreten): {ohneVorjahr.map((z) => z.u.name).join(", ")}. Diese
          Personen richten ihre Jahresdaten über »Einrichtung« im Konto selbst ein.
        </p>
      )}
      {zukunft ? (
        <p>
          Jahresdaten für {jahr} lassen sich erst ab dem 1. Januar {jahr} anlegen. Bis dahin kann nur die
          Feiertagsliste vorbereitet werden.
        </p>
      ) : (
        fehlend > 0 && (
          <form action={jahrVorbereiten}>
            <input type="hidden" name="jahr" value={jahr} />
            <button type="submit">Jahresdaten {jahr} für {fehlend} Personen anlegen</button>
          </form>
        )
      )}
      {!zukunft && fehlend === 0 && <p>Alle Personen mit Daten aus {vorjahr} haben Jahresdaten für {jahr}.</p>}
    </main>
  );
}
