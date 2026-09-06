import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

// Live-Daten aus der DB — nie statisch vorrendern (sonst zeigt die Seite einen eingefrorenen
// Stand vom Build-Zeitpunkt, siehe CLAUDE.md Deployment-Hinweise).
export const dynamic = "force-dynamic";

function aktuellerMonatPfad(userId: string): string {
  const jetzt = new Date();
  return `/mitarbeiter/${userId}/${jetzt.getFullYear()}/${jetzt.getMonth() + 1}`;
}

export default async function StartPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = (session.user as { role?: string }).role;
  const meineId = (session.user as { id?: string }).id;

  // Mitarbeitende landen direkt in ihrer eigenen aktuellen Monatsansicht — nur Stefan (Admin)
  // sieht die Übersicht aller Mitarbeitenden (CLAUDE.md §5).
  if (role !== "ADMIN" && meineId) {
    redirect(aktuellerMonatPfad(meineId));
  }

  const users = await prisma.user.findMany({
    include: { company: true },
    orderBy: { name: "asc" },
  });

  return (
    <main>
      <h1>Zeiterfassung – Alta Engineering AG</h1>
      <p className="subtitle">Übersicht aller Mitarbeitenden und ihrer Zeiterfassung.</p>

      <h2>Mitarbeitende</h2>
      <ul className="employee-list">
        {users.map((u) => (
          <li key={u.id}>
            <Link href={aktuellerMonatPfad(u.id)}>{u.name}</Link>
            <span className="role-badge">{u.role === "ADMIN" ? "Admin" : "Mitarbeiter"}</span>
            <span className="muted" style={{ fontSize: "0.85rem", marginLeft: 8 }}>
              {u.company.name}
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}
