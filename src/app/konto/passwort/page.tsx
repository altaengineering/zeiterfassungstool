import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { PasswortForm } from "./PasswortForm";

export default async function PasswortSeite() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <main>
      <h1>Passwort ändern</h1>
      <p className="subtitle">Angemeldet als {session.user.name}</p>
      <div className="konto-card">
        <PasswortForm />
      </div>
    </main>
  );
}
