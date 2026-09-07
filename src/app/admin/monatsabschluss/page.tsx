import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { monatAbschliessen, monatOeffnen } from "./actions";

export const dynamic = "force-dynamic";

const MONATSNAMEN = [
  "Jan", "Feb", "Mar", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez",
] as const;

export default async function MonatsabschlussSeite({
  searchParams,
}: {
  searchParams: Promise<{ jahr?: string }>;
}) {
  const session = await auth();
  const rolle = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || rolle !== "ADMIN") redirect("/");

  const userId = (session.user as { id: string }).id;
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  const { jahr: jahrParam } = await searchParams;
  const jahr = jahrParam ? Number(jahrParam) : new Date().getFullYear();

  const geschlossen = await prisma.monthClose.findMany({
    where: { companyId: user.companyId, year: jahr },
  });
  const geschlosseneMonate = new Set(geschlossen.map((g) => g.month));

  return (
    <main>
      <h1>Monatsabschluss</h1>
      <p className="subtitle">
        Ein abgeschlossener Monat kann von Mitarbeitenden nicht mehr bearbeitet werden (z.B. nach
        dem Lohnlauf). Gilt firmenweit für alle Mitarbeitenden. Jederzeit wieder öffnbar.
      </p>

      <div className="month-nav">
        <Link href={`/admin/monatsabschluss?jahr=${jahr - 1}`}>← {jahr - 1}</Link>
        <span className="current">{jahr}</span>
        <Link href={`/admin/monatsabschluss?jahr=${jahr + 1}`}>{jahr + 1} →</Link>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Monat</th>
              <th className="label-cell">Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {MONATSNAMEN.map((name, i) => {
              const monat = i + 1;
              const istGeschlossen = geschlosseneMonate.has(monat);
              return (
                <tr key={monat}>
                  <td className="label-cell">
                    {name} {jahr}
                  </td>
                  <td className="label-cell">{istGeschlossen ? "🔒 abgeschlossen" : "offen"}</td>
                  <td className="label-cell">
                    <form action={istGeschlossen ? monatOeffnen : monatAbschliessen}>
                      <input type="hidden" name="year" value={jahr} />
                      <input type="hidden" name="month" value={monat} />
                      <button type="submit" className="link-btn-inline">
                        {istGeschlossen ? "wieder öffnen" : "abschliessen"}
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
