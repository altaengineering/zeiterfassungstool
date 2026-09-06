import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ResetPasswordButton } from "./ResetPasswordButton";
import { AddUserForm } from "./AddUserForm";
import { DeleteUserButton } from "./DeleteUserButton";

export const dynamic = "force-dynamic";

export default async function AdminSeite() {
  const session = await auth();
  const rolle = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || rolle !== "ADMIN") redirect("/");

  const meineId = (session.user as { id: string }).id;

  const users = await prisma.user.findMany({
    include: { company: true },
    orderBy: { name: "asc" },
  });

  const jetzt = new Date();

  return (
    <main>
      <h1>Nutzerverwaltung</h1>
      <p className="subtitle">
        Alle Mitarbeitenden von {users[0]?.company.name ?? "Alta Engineering AG"}. Passwort
        vergessen? Hier zurücksetzen und das neue Passwort sicher weitergeben (z.B. persönlich
        oder verschlüsselt).
      </p>

      <AddUserForm />

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>E-Mail</th>
              <th>Rolle</th>
              <th>Monatsansicht</th>
              <th>Passwort</th>
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
                <td className="label-cell">
                  <Link href={`/mitarbeiter/${u.id}/${jetzt.getFullYear()}/${jetzt.getMonth() + 1}`}>
                    öffnen
                  </Link>
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
