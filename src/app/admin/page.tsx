import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ResetPasswordButton } from "./ResetPasswordButton";
import { AddUserForm } from "./AddUserForm";
import { DeleteUserButton } from "./DeleteUserButton";
import { vergleicheDienstalter } from "@/lib/dienstalter";
import { normalisiereStatus } from "@/lib/einfacheErfassung";
import { einfacheErfassungSetzen } from "./actions";

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

  const antraege = users.filter((u) => normalisiereStatus(u.einfacheErfassung) === "beantragt");

  // Knopf fuer Ein-/Ausschalten der einfachen Erfassung (Erlaubnis vom Chef)
  const erfassungKnopf = (userId: string, ziel: "an" | "aus", text: string, sekundaer = false) => (
    <form action={einfacheErfassungSetzen} style={{ display: "inline" }}>
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="status" value={ziel} />
      <button type="submit" className={"einfach-knopf" + (sekundaer ? " einfach-knopf-sekundaer" : "")}>
        {text}
      </button>
    </form>
  );

  return (
    <main>
      <h1>Nutzerverwaltung</h1>
      <p className="subtitle">
        Alle Mitarbeitenden von {users[0]?.company.name ?? "Alta Engineering AG"}. Passwort
        vergessen? Hier zurücksetzen und das neue Passwort sicher weitergeben (z.B. persönlich
        oder verschlüsselt).
      </p>

      {antraege.length > 0 && (
        <div className="entry-form-card einfach-antraege" style={{ marginBottom: 16 }}>
          <div className="form-section-title">Anträge auf einfache Erfassung ({antraege.length})</div>
          <p className="form-hint">
            Diese Personen möchten pro Tag nur noch die Ist-Zeit eintragen, ohne Stempelzeiten,
            ohne Projekte und ohne Abgleich. Erst mit deiner Freigabe wird es eingeschaltet.
          </p>
          {antraege.map((u) => (
            <div key={u.id} className="einfach-antrag-zeile">
              <strong>{u.name}</strong>
              <span className="form-hint">beantragt am {formatDatum(u.einfacheErfassungSeit)}</span>
              <span className="einfach-antrag-knoepfe">
                {erfassungKnopf(u.id, "an", "Freigeben")}
                {erfassungKnopf(u.id, "aus", "Ablehnen", true)}
              </span>
            </div>
          ))}
        </div>
      )}

      <AddUserForm />

      <div className="table-wrap">
        <table className="nutzer-tabelle">
          <thead>
            <tr>
              <th>Mitarbeiter:in</th>
              <th className="label-cell">Rolle</th>
              <th className="label-cell">Eintritt</th>
              <th className="label-cell">Ansicht &amp; Verwaltung</th>
              <th className="label-cell">Erfassung</th>
              <th className="label-cell">Konto</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="label-cell">
                  <div className="nutzer-name">{u.name}</div>
                  <div className="nutzer-mail">{u.email}</div>
                </td>
                <td className="label-cell">
                  {u.email === "m.kueng@alta-engineering.ch"
                    ? "sudo"
                    : u.role === "ADMIN"
                      ? "Admin"
                      : "Mitarbeiter"}
                </td>
                <td className="label-cell">{formatDatum(u.eintrittsdatum)}</td>
                <td className="label-cell">
                  <div className="nutzer-links">
                    <Link href={`/mitarbeiter/${u.id}/${jetzt.getFullYear()}/${jetzt.getMonth() + 1}`}>
                      Monatsansicht
                    </Link>
                    <Link href={`/admin/pensum/${u.id}`}>Pensum</Link>
                    <Link href={`/abwesenheiten?userId=${u.id}`}>Abwesenheiten</Link>
                  </div>
                </td>
                <td className="label-cell">
                  {normalisiereStatus(u.einfacheErfassung) === "an" ? (
                    <div className="nutzer-erfassung">
                      <span className="einfach-tag">Einfach (nur Ist-Zeit)</span>
                      {erfassungKnopf(u.id, "aus", "ausschalten", true)}
                    </div>
                  ) : normalisiereStatus(u.einfacheErfassung) === "beantragt" ? (
                    <div className="nutzer-erfassung">
                      <span className="einfach-tag einfach-tag-offen">beantragt</span>
                      {erfassungKnopf(u.id, "an", "freigeben")}
                    </div>
                  ) : (
                    <div className="nutzer-erfassung">
                      <span className="form-hint">normal</span>
                      {erfassungKnopf(u.id, "an", "einfach erlauben", true)}
                    </div>
                  )}
                </td>
                <td className="label-cell">
                  <div className="nutzer-links">
                    <ResetPasswordButton userId={u.id} name={u.name} />
                    {u.id !== meineId && <DeleteUserButton userId={u.id} name={u.name} />}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
