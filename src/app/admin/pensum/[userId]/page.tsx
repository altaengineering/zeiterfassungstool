import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { pensumWechselHinzufuegen, pensumWechselLoeschen } from "./actions";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ userId: string }>;
};

export default async function PensumSeite({ params }: Props) {
  const session = await auth();
  const rolle = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || rolle !== "ADMIN") redirect("/");

  const { userId } = await params;
  const jahr = new Date().getFullYear();

  const [user, jahresStammdaten, wechselListe] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.jahresStammdaten.findUnique({ where: { userId_year: { userId, year: jahr } } }),
    prisma.pensumWechsel.findMany({ where: { userId }, orderBy: { gueltigAb: "asc" } }),
  ]);
  if (!user) redirect("/admin");

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
              <th>Anstellung %</th>
              <th>Wochenstunden</th>
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
