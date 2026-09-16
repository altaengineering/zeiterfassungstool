import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ResetPasswordButton } from "./ResetPasswordButton";
import { AddUserForm } from "./AddUserForm";
import { DeleteUserButton } from "./DeleteUserButton";
import { DienstalterButton } from "./DienstalterButton";
import { vergleicheDienstalter } from "@/lib/dienstalter";

export const dynamic = "force-dynamic";

export default async function AdminSeite() {
  const session = await auth();
  const rolle = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || rolle !== "ADMIN") redirect("/");

  const meineId = (session.user as { id: string }).id;

  const usersDb = await prisma.user.findMany({
    include: { company: true },
    orderBy: { name: "asc" },
  });
  // Nach Dienstalter (Firmeneintritt) statt Namen, siehe src/lib/dienstalter.ts. Wer noch kein
  // importiertes Eintrittsdatum hat, steht ans Ende gestellt (nicht geraten).
  const users = [...usersDb].sort(vergleicheDienstalter);

  const jetzt = new Date();
  const formatDatum = (d: Date | null) =>
    d ? d.toLocaleDateString("de-CH", { year: "numeric", month: "2-digit", day: "2-digit" }) : "—";

  return (
    <main>
      <h1>Nutzerverwaltung</h1>
      <p className="subtitle">
        Alle Mitarbeitenden von {users[0]?.company.name ?? "Alta Engineering AG"}. Passwort
        vergessen? Hier zurücksetzen und das neue Passwort sicher weitergeben (z.B. persönlich
        oder verschlüsselt).
      </p>

      <AddUserForm />

      <div className="entry-form-card" style={{ marginBottom: 16 }}>
        <div className="form-section-title">Reihenfolge nach Dienstalter</div>
        <p className="form-hint">
          Die Liste unten ist nach Firmeneintritt sortiert (älteste zuerst), genauso wie die
          Chef-Übersicht. Einmalig aus der von Michael gelieferten Liste importieren:
        </p>
        <DienstalterButton />
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th className="label-cell">E-Mail</th>
              <th className="label-cell">Rolle</th>
              <th className="label-cell">Eintritt</th>
              <th className="label-cell">Monatsansicht</th>
              <th className="label-cell">Pensum</th>
              <th className="label-cell">Passwort</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="label-cell">{u.name}</td>
                <td className="label-cell">{u.email}</td>
                <td className="label-cell">
                  {u.email === "m.kueng@alta-engineering.ch"
                    ? "sudo"
                    : u.role === "ADMIN"
                      ? "Admin"
                      : "Mitarbeiter"}
                </td>
                <td className="label-cell">{formatDatum(u.eintrittsdatum)}</td>
                <td className="label-cell">
                  <Link href={`/mitarbeiter/${u.id}/${jetzt.getFullYear()}/${jetzt.getMonth() + 1}`}>
                    öffnen
                  </Link>
                </td>
                <td className="label-cell">
                  <Link href={`/admin/pensum/${u.id}`}>ändern</Link>
                </td>
                <td className="label-cell">
                  <ResetPasswordButton userId={u.id} name={u.name} />
                </td>
                <td className="label-cell">
                  {u.id !== meineId && <DeleteUserButton userId={u.id} name={u.name} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
