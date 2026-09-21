import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  berechneFerienBezogen,
  berechneFerienBezogenGesamt,
  berechneFerienGuthaben,
  berechneFerienuebertragNaechstesJahr,
  sollProTag,
  STANDARD_JAHRESFERIENTAGE,
} from "@/lib/calc";
import { EinrichtungForm } from "./EinrichtungForm";

export const dynamic = "force-dynamic";

export default async function EinrichtungSeite() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userId = (session.user as { id: string }).id;
  const jahr = new Date().getFullYear();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const [stammdaten, companySettings, entriesDb] = await Promise.all([
    prisma.jahresStammdaten.findUnique({ where: { userId_year: { userId, year: jahr } } }),
    prisma.companySettings.findUnique({
      where: { companyId_year: { companyId: user.companyId, year: jahr } },
    }),
    prisma.dailyEntry.findMany({
      where: { userId, date: { gte: new Date(Date.UTC(jahr, 0, 1)), lt: new Date(Date.UTC(jahr + 1, 0, 1)) } },
    }),
  ]);
  const standardJahresferientage = companySettings?.jahresferientage ?? STANDARD_JAHRESFERIENTAGE;

  // Live-Werte direkt auf der Einrichtungsseite: sonst sieht man erst auf der Monatsseite, ob die
  // eingetragenen Werte zu einem sinnvollen "wieviele Ferien bekomme ich, wieviele habe ich noch"
  // fuehren, siehe Chef-Uebersicht/Admin-Panel fuer dasselbe Muster.
  let ferienGuthaben: number | null = null;
  let ferienBezogen: number | null = null;
  let ferienUebertrag: number | null = null;
  if (stammdaten) {
    const jahresferientageEffektiv = stammdaten.jahresferientage ?? standardJahresferientage;
    ferienGuthaben = berechneFerienGuthaben(
      stammdaten.ferienuebertragAltesJahr,
      stammdaten.arbeitsmonate,
      jahresferientageEffektiv,
    );
    const ferienStundenProMonat = Array.from({ length: 12 }, (_, m) =>
      entriesDb.filter((e) => e.date.getUTCMonth() === m).reduce((sum, e) => sum + e.ferien, 0),
    );
    const sollProTagWert = sollProTag(stammdaten.wochenstunden, stammdaten.anstellungPct);
    ferienBezogen = berechneFerienBezogenGesamt(
      berechneFerienBezogen(ferienStundenProMonat, sollProTagWert),
      stammdaten.ferienBezogenKorrektur,
    );
    ferienUebertrag = berechneFerienuebertragNaechstesJahr(ferienGuthaben, ferienBezogen);
  }

  const heute = new Date().toISOString().slice(0, 10);
  const defaultDatum = stammdaten?.erfassungStartDatum
    ? stammdaten.erfassungStartDatum.toISOString().slice(0, 10)
    : heute;

  return (
    <main>
      <h1>Einrichtung</h1>
      <p className="subtitle">
        Lege fest, ab welchem Tag deine Zeiterfassung im Tool zählt, und trage deinen aktuellen
        Überstunden- und Ferienstand ein. Tage <b>vor</b> diesem Datum werden nicht mitgerechnet
        (kein künstliches Minus, weil vorher nichts erfasst wurde). Du kannst das jederzeit
        anpassen.
      </p>
      <p className="form-message small" style={{ maxWidth: 520 }}>
        Wichtig: Nur ausfüllen, wenn für Tage vor dem Startdatum <b>keine</b> echten Einträge
        bestehen. Hast du bereits erfasste Arbeitstage (z.B. übernommene Daten aus Excel), zählt
        dein Saldo für diese bereits korrekt — die Einrichtung würde sie sonst auf 0 überschreiben.
      </p>
      {stammdaten && (
        <div className="card-row" style={{ marginBottom: 16 }}>
          <div className="card card-accent card-accent-blau">
            <div className="label">Ferien, die du bekommst ({jahr})</div>
            <div className="value">{ferienGuthaben != null ? `${ferienGuthaben.toFixed(1)} Tage` : "–"}</div>
          </div>
          <div className="card card-accent card-accent-blau">
            <div className="label">Ferien bezogen</div>
            <div className="value">{ferienBezogen != null ? `${ferienBezogen.toFixed(1)} Tage` : "–"}</div>
          </div>
          <div className="card card-accent card-accent-blau">
            <div className="label">Ferien, die du noch hast</div>
            <div className="value">{ferienUebertrag != null ? `${ferienUebertrag.toFixed(1)} Tage` : "–"}</div>
          </div>
        </div>
      )}
      <div className="konto-card">
        <EinrichtungForm
          defaultDatum={defaultDatum}
          defaultStundenSaldo={stammdaten?.stundenuebertragAltesJahr ?? 0}
          defaultFerienGuthaben={stammdaten?.ferienuebertragAltesJahr ?? 0}
          defaultJahresferientage={stammdaten?.jahresferientage ?? null}
          standardJahresferientage={standardJahresferientage}
          defaultFerienBezogenKorrektur={stammdaten?.ferienBezogenKorrektur ?? 0}
          istEingerichtet={stammdaten?.erfassungStartDatum != null}
        />
      </div>
    </main>
  );
}
