import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { STANDARD_JAHRESFERIENTAGE } from "@/lib/calc";
import { berechneFerienSaldo } from "@/lib/ferienSaldo";
import { FerienEinrichtungForm } from "./FerienEinrichtungForm";

export const dynamic = "force-dynamic";

export default async function FerienEinrichtungSeite() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userId = (session.user as { id: string }).id;
  const jahr = new Date().getFullYear();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const [stammdaten, companySettings, saldo] = await Promise.all([
    prisma.jahresStammdaten.findUnique({ where: { userId_year: { userId, year: jahr } } }),
    prisma.companySettings.findUnique({
      where: { companyId_year: { companyId: user.companyId, year: jahr } },
    }),
    berechneFerienSaldo(userId, jahr),
  ]);
  const standardJahresferientage = companySettings?.jahresferientage ?? STANDARD_JAHRESFERIENTAGE;

  return (
    <main>
      <h1>Ferien-Einrichtung</h1>
      <p className="subtitle">
        Nur dein aktueller Ferien-Saldo und dein Jahresanspruch, sonst nichts. Für Startdatum
        und Überstunden-Saldo gibt es die separate{" "}
        <a href="/konto/einrichtung">grosse Einrichtung</a>, falls die auch noch offen ist.
      </p>

      {saldo && (
        <div className="card-row" style={{ marginBottom: 16 }}>
          <div className="card card-accent card-accent-blau">
            <div className="label">Ferien, die du bekommst ({jahr})</div>
            <div className="value">{saldo.ferienGuthaben.toFixed(1)} Tage</div>
          </div>
          <div className="card card-accent card-accent-gruen">
            <div className="label">Ferien, die du noch hast</div>
            <div className={"value" + (saldo.ferienUebertrag < 0 ? " neg" : "")}>
              {saldo.ferienUebertrag.toFixed(1)} Tage
            </div>
          </div>
        </div>
      )}

      <div className="konto-card">
        <FerienEinrichtungForm
          defaultAktuellerSaldo={saldo?.ferienUebertrag ?? 0}
          defaultJahresferientage={stammdaten?.jahresferientage ?? null}
          standardJahresferientage={standardJahresferientage}
        />
      </div>
    </main>
  );
}
