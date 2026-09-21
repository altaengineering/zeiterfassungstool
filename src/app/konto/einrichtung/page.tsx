import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { STANDARD_JAHRESFERIENTAGE } from "@/lib/calc";
import { EinrichtungForm } from "./EinrichtungForm";

export const dynamic = "force-dynamic";

export default async function EinrichtungSeite() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userId = (session.user as { id: string }).id;
  const jahr = new Date().getFullYear();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const [stammdaten, companySettings] = await Promise.all([
    prisma.jahresStammdaten.findUnique({ where: { userId_year: { userId, year: jahr } } }),
    prisma.companySettings.findUnique({
      where: { companyId_year: { companyId: user.companyId, year: jahr } },
    }),
  ]);
  const standardJahresferientage = companySettings?.jahresferientage ?? STANDARD_JAHRESFERIENTAGE;

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
      <div className="konto-card">
        <EinrichtungForm
          defaultDatum={defaultDatum}
          defaultStundenSaldo={stammdaten?.stundenuebertragAltesJahr ?? 0}
          defaultFerienGuthaben={stammdaten?.ferienuebertragAltesJahr ?? 0}
          defaultJahresferientage={stammdaten?.jahresferientage ?? null}
          standardJahresferientage={standardJahresferientage}
          istEingerichtet={stammdaten?.erfassungStartDatum != null}
        />
      </div>
    </main>
  );
}
