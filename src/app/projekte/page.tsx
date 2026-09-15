import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { projektHinzufuegen } from "./actions";
import { ProjektZeile } from "./ProjektZeile";
import { MigrateButton } from "./MigrateButton";

export const dynamic = "force-dynamic";

export default async function ProjekteSeite() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userId = (session.user as { id: string }).id;
  const [projekte, hatOffeneAltbuchungen] = await Promise.all([
    prisma.project.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { bookings: true } } },
    }),
    prisma.booking.count({
      where: {
        dailyEntry: { userId },
        OR: [{ projectId: null }, { project: { userId: null } }],
      },
    }),
  ]);

  const aktiveProjekte = projekte.filter((p) => p.aktiv);
  const deaktivierteProjekte = projekte.filter((p) => !p.aktiv);
  const buchungenGesamt = projekte.reduce((summe, p) => summe + p._count.bookings, 0);

  return (
    <main>
      <h1>Meine Projekte</h1>
      <p className="subtitle">
        Das hier ist deine ganz persönliche Liste, niemand sonst sieht oder verändert sie. Trage
        hier ein, an welchen Projekten oder Kunden du arbeitest. Beim Tageseintrag wählst du dann
        einfach aus dieser Liste aus, statt jedes Mal von Hand einen Namen einzutippen, das
        vermeidet Tippfehler und macht den Excel-Export sauberer.
      </p>

      <div className="card-row">
        <div className="card card-accent card-accent-blau">
          <div className="label">Aktive Projekte</div>
          <div className="value">{aktiveProjekte.length}</div>
        </div>
        <div className="card card-accent card-accent-blau">
          <div className="label">Deaktiviert</div>
          <div className="value">{deaktivierteProjekte.length}</div>
        </div>
        <div className="card card-accent card-accent-blau">
          <div className="label">Buchungen gesamt</div>
          <div className="value">{buchungenGesamt}</div>
        </div>
      </div>

      <div className="entry-form-card" style={{ marginBottom: 24 }}>
        <form action={projektHinzufuegen} className="entry-form">
          <label>
            Neues Projekt hinzufügen
            <input type="text" name="name" placeholder="z.B. Raytech AG" required />
          </label>
          <div className="entry-form-footer">
            <button type="submit">Hinzufügen</button>
          </div>
        </form>
      </div>

      {projekte.length === 0 ? (
        <p className="form-hint">
          Noch keine Projekte angelegt. Trag oben dein erstes ein, zum Beispiel den Namen des
          Kunden, an dem du gerade arbeitest.
        </p>
      ) : (
        <>
          <div className="projekt-abschnitt-title">
            <span className="projekt-abschnitt-punkt projekt-abschnitt-punkt-aktiv" />
            Aktiv ({aktiveProjekte.length})
          </div>
          {aktiveProjekte.length > 0 ? (
            <div className="projekt-liste">
              {aktiveProjekte.map((p) => (
                <ProjektZeile
                  key={p.id}
                  id={p.id}
                  name={p.name}
                  aktiv={p.aktiv}
                  anzahlBuchungen={p._count.bookings}
                />
              ))}
            </div>
          ) : (
            <p className="form-hint">Keine aktiven Projekte, alle oben eingetragenen sind deaktiviert.</p>
          )}

          {deaktivierteProjekte.length > 0 && (
            <>
              <div className="projekt-abschnitt-title" style={{ marginTop: 24 }}>
                <span className="projekt-abschnitt-punkt" />
                Deaktiviert ({deaktivierteProjekte.length})
              </div>
              <div className="projekt-liste">
                {deaktivierteProjekte.map((p) => (
                  <ProjektZeile
                    key={p.id}
                    id={p.id}
                    name={p.name}
                    aktiv={p.aktiv}
                    anzahlBuchungen={p._count.bookings}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {hatOffeneAltbuchungen > 0 && (
        <div className="entry-form-card migrate-card" style={{ marginTop: 24 }}>
          <div className="form-section-title">Alte Einträge gefunden</div>
          <p className="form-hint">
            Du hast noch {hatOffeneAltbuchungen} alte Buchung{hatOffeneAltbuchungen === 1 ? "" : "en"}{" "}
            aus der Zeit, als man den Projektnamen noch von Hand eintippen konnte. Mit einem Klick
            richten wir dafür automatisch die passenden Projekte oben in deiner Liste ein und
            verknüpfen deine alten Einträge damit. Es geht nichts verloren, du kannst auch
            mehrfach klicken, das schadet nicht.
          </p>
          <MigrateButton />
        </div>
      )}
    </main>
  );
}
