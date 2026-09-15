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
  const projekte = await prisma.project.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  const hatOffeneAltbuchungen = await prisma.booking.count({
    where: {
      dailyEntry: { userId },
      OR: [{ projectId: null }, { project: { userId: null } }],
    },
  });

  return (
    <main>
      <h1>Meine Projekte</h1>
      <p className="subtitle">
        Das hier ist deine ganz persönliche Liste, niemand sonst sieht oder verändert sie. Trage
        hier ein, an welchen Projekten oder Kunden du arbeitest. Beim Tageseintrag wählst du dann
        einfach aus dieser Liste aus, statt jedes Mal von Hand einen Namen einzutippen, das
        vermeidet Tippfehler und macht den Excel-Export sauberer.
      </p>

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

      <div className="projekt-liste">
        {projekte.map((p) => (
          <ProjektZeile key={p.id} id={p.id} name={p.name} aktiv={p.aktiv} />
        ))}
        {projekte.length === 0 && (
          <p className="form-hint">
            Noch keine Projekte angelegt. Trag oben dein erstes ein, zum Beispiel den Namen des
            Kunden, an dem du gerade arbeitest.
          </p>
        )}
      </div>

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
