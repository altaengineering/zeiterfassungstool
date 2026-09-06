import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { feiertagHinzufuegen, feiertagLoeschen } from "./actions";

export const dynamic = "force-dynamic";

export default async function FeiertageSeite() {
  const session = await auth();
  const rolle = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || rolle !== "ADMIN") redirect("/");

  const userId = (session.user as { id: string }).id;
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const feiertage = await prisma.holiday.findMany({
    where: { companyId: user.companyId },
    orderBy: { date: "asc" },
  });

  return (
    <main>
      <h1>Feiertage verwalten</h1>
      <p className="subtitle">
        Gilt für die ganze Firma und alle Jahre. Ein bezahlter Feiertag setzt den Tages-Soll auf 0,
        ein unbezahlter Feiertag zählt wie ein normaler Arbeitstag (siehe CLAUDE.md §3).
      </p>

      <div className="entry-form-card" style={{ marginBottom: 24 }}>
        <form action={feiertagHinzufuegen} className="entry-form">
          <div className="form-row-pair">
            <label>
              Datum
              <input type="date" name="datum" required />
            </label>
            <label>
              Bezeichnung
              <input type="text" name="label" placeholder="z.B. Neujahr" required />
            </label>
          </div>
          <label style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <input type="checkbox" name="bezahlt" defaultChecked style={{ width: "auto" }} />
            Bezahlt
          </label>
          <div className="entry-form-footer">
            <button type="submit">Feiertag speichern</button>
          </div>
        </form>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Datum</th>
              <th>Bezeichnung</th>
              <th>Bezahlt</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {feiertage.map((f) => (
              <tr key={f.id}>
                <td className="label-cell">{f.date.toISOString().slice(0, 10)}</td>
                <td className="label-cell">{f.label.trim()}</td>
                <td className="label-cell">{f.bezahlt ? "ja" : "nein"}</td>
                <td className="label-cell">
                  <form action={feiertagLoeschen}>
                    <input type="hidden" name="id" value={f.id} />
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
