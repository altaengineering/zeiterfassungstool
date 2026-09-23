import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { berechneFerienSaldo } from "@/lib/ferienSaldo";
import { FerienAntragForm } from "./FerienAntragForm";
import { ferienAntragZuruecknehmen } from "./actions";

export const dynamic = "force-dynamic";

function fmtDatum(d: Date): string {
  return d.toISOString().slice(8, 10) + "." + d.toISOString().slice(5, 7) + "." + d.toISOString().slice(0, 4);
}

const STATUS_LABEL: Record<string, string> = {
  offen: "offen",
  genehmigt: "genehmigt",
  abgelehnt: "abgelehnt",
};

export default async function FerienSeite() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userId = (session.user as { id: string }).id;
  const jahr = new Date().getFullYear();

  const [saldo, antraegeDb] = await Promise.all([
    berechneFerienSaldo(userId, jahr),
    prisma.ferienAntrag.findMany({ where: { userId }, orderBy: { erstelltAm: "desc" } }),
  ]);

  const heute = new Date().toISOString().slice(0, 10);

  return (
    <main>
      <h1>Ferien</h1>
      <p className="subtitle">
        Ferien planen, beantragen und deinen aktuellen Saldo im Blick behalten. Ein Admin
        entscheidet über jeden Antrag, du siehst den Status hier live.
      </p>

      {saldo ? (
        <div className="card-row" style={{ marginBottom: 16 }}>
          <div className="card card-accent card-accent-blau">
            <div className="label">Ferien, die du {jahr} bekommst</div>
            <div className="value">{saldo.ferienGuthaben.toFixed(1)} Tage</div>
          </div>
          <div className="card card-accent card-accent-blau">
            <div className="label">Bereits bezogen</div>
            <div className="value">{saldo.ferienBezogen.toFixed(1)} Tage</div>
          </div>
          <div className="card card-accent card-accent-gruen">
            <div className="label">Noch übrig</div>
            <div className={"value" + (saldo.ferienUebertrag < 0 ? " neg" : "")}>
              {saldo.ferienUebertrag.toFixed(1)} Tage
            </div>
          </div>
        </div>
      ) : (
        <p className="form-message small">
          Für dieses Jahr sind noch keine Jahres-Stammdaten hinterlegt, dein Saldo kann deshalb
          nicht berechnet werden. Bitte bei einem Admin melden.
        </p>
      )}

      <div className="konto-card">
        <h2 style={{ marginTop: 0 }}>Neuer Antrag</h2>
        <FerienAntragForm heute={heute} />
      </div>

      <h2>Deine Anträge</h2>
      {antraegeDb.length === 0 ? (
        <p className="form-hint">Noch keine Ferienanträge gestellt.</p>
      ) : (
        <div className="ferien-antraege-liste">
          {antraegeDb.map((a) => (
            <div key={a.id} className="ferien-antrag-zeile">
              <div className="ferien-antrag-info">
                <span>
                  <strong>
                    {fmtDatum(a.von)} – {fmtDatum(a.bis)}
                  </strong>{" "}
                  ({a.arbeitstage} {a.arbeitstage === 1 ? "Arbeitstag" : "Arbeitstage"})
                </span>
                {a.kommentar && <span className="ferien-antrag-kommentar">{a.kommentar}</span>}
              </div>
              <div className="ferien-antrag-aktionen">
                <span className={`status-badge status-badge-${a.status}`}>
                  {STATUS_LABEL[a.status] ?? a.status}
                </span>
                {a.status === "offen" && (
                  <form action={ferienAntragZuruecknehmen}>
                    <input type="hidden" name="antragId" value={a.id} />
                    <button type="submit" className="link-btn-inline">
                      Zurücknehmen
                    </button>
                  </form>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
