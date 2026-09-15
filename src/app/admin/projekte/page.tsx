import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { projektHinzufuegen, projektAktivSchalten, projektUmbenennen } from "./actions";
import { MigrateButton } from "./MigrateButton";

export const dynamic = "force-dynamic";

export default async function ProjekteSeite() {
  const session = await auth();
  const rolle = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || rolle !== "ADMIN") redirect("/");

  const userId = (session.user as { id: string }).id;
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const projekte = await prisma.project.findMany({
    where: { companyId: user.companyId },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { bookings: true } } },
  });

  const aktiveAnzahl = projekte.filter((p) => p.aktiv).length;

  return (
    <main>
      <h1>Projekte verwalten</h1>
      <p className="subtitle">
        Feste Projektliste für die ganze Firma. Im Tageseintrag wird nur noch aus dieser Liste
        gewählt statt frei getippt, damit im Excel-Export immer dieselben, konsistenten Spalten
        entstehen. Ein Projekt lässt sich nicht löschen, nur deaktivieren (sonst würden alte
        Buchungen dazu ihre Zuordnung verlieren). Deaktivierte Projekte tauchen im
        Tageseintrag-Formular nicht mehr zur Auswahl auf, bleiben aber in bestehenden Buchungen
        und im Export sichtbar.
      </p>
      {aktiveAnzahl > 9 && (
        <p className="form-message error" style={{ maxWidth: 620 }}>
          Achtung: {aktiveAnzahl} aktive Projekte, die Excel-Vorlage hat aber nur 9 Projekt-Spalten
          (C–K). Im Export werden nur die 9 zuerst angelegten aktiven Projekte berücksichtigt,
          weitere fehlen. Bitte nicht mehr benötigte Projekte deaktivieren.
        </p>
      )}

      <div className="entry-form-card" style={{ marginBottom: 24 }}>
        <form action={projektHinzufuegen} className="entry-form">
          <label>
            Neues Projekt
            <input type="text" name="name" placeholder="z.B. Raytech AG" required />
          </label>
          <div className="entry-form-footer">
            <button type="submit">Projekt anlegen</button>
          </div>
        </form>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="label-cell">Name</th>
              <th>Buchungen</th>
              <th className="label-cell">Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {projekte.map((p) => (
              <tr key={p.id}>
                <td className="label-cell">
                  <form action={projektUmbenennen} style={{ display: "flex", gap: 8 }}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="text" name="name" defaultValue={p.name} style={{ maxWidth: 220 }} />
                    <button type="submit" className="link-btn-inline">
                      speichern
                    </button>
                  </form>
                </td>
                <td>{p._count.bookings}</td>
                <td className="label-cell">{p.aktiv ? "aktiv" : "deaktiviert"}</td>
                <td className="label-cell">
                  <form action={projektAktivSchalten}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="aktiv" value={String(p.aktiv)} />
                    <button type="submit" className="link-btn-inline">
                      {p.aktiv ? "deaktivieren" : "aktivieren"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {projekte.length === 0 && (
              <tr>
                <td colSpan={4} className="label-cell">
                  Noch keine Projekte angelegt.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="entry-form-card" style={{ marginTop: 24 }}>
        <div className="form-section-title">Migration alter Buchungen</div>
        <p className="form-hint">
          Buchungen aus der Zeit vor der festen Projektliste (freier Text) einmalig übernehmen:
          legt für jeden bisher unbekannten Text automatisch ein Projekt an und verknüpft die
          Buchung damit. Kann gefahrlos mehrfach ausgeführt werden.
        </p>
        <MigrateButton />
      </div>
    </main>
  );
}
