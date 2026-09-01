import Link from "next/link";
import { prisma } from "@/lib/db";

// Live-Daten aus der DB — nie statisch vorrendern (sonst zeigt die Seite einen eingefrorenen
// Stand vom Build-Zeitpunkt, siehe CLAUDE.md Deployment-Hinweise).
export const dynamic = "force-dynamic";

export default async function StartPage() {
  const users = await prisma.user.findMany({
    include: { company: true },
    orderBy: { name: "asc" },
  });

  const now = new Date();

  return (
    <main>
      <h1>Zeiterfassung – Alta Engineering AG</h1>
      <p className="subtitle">
        Proof of Concept: direkte Online-Erfassung statt Excel-Upload. Datenmodell &amp;
        Berechnungslogik 1:1 aus dem bestehenden Arbeitsrapport übernommen.
      </p>

      <h2>Mitarbeitende</h2>
      <ul className="employee-list">
        {users.map((u) => (
          <li key={u.id}>
            <Link href={`/mitarbeiter/${u.id}/2026/6`}>{u.name}</Link>
            <span className="role-badge">{u.role === "ADMIN" ? "Admin" : "Mitarbeiter"}</span>
            <span style={{ color: "#888", fontSize: "0.85rem", marginLeft: 8 }}>
              {u.company.name}
            </span>
          </li>
        ))}
      </ul>
      <p style={{ fontSize: "0.8rem", color: "#888", marginTop: 24 }}>
        Demo-Zeitraum: Juni {now.getFullYear() === 2026 ? "2026 (aktuell)" : "2026"} — Michael
        Küngs Monatsansicht enthält reale Beispieldaten aus der Original-Excel-Datei.
      </p>
    </main>
  );
}
