import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/lib/auth";

async function login(formData: FormData) {
  "use server";
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/login?error=1");
    }
    throw error;
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main style={{ maxWidth: 400 }}>
      <h1>Zeiterfassung – Login</h1>
      <div className="entry-form-card">
        <form action={login} className="entry-form">
          {error && (
            <p style={{ color: "var(--neg)", fontSize: "0.85rem", margin: 0 }}>
              E-Mail oder Passwort falsch.
            </p>
          )}
          <label>
            E-Mail
            <input type="email" name="email" required autoFocus />
          </label>
          <label>
            Passwort
            <input type="password" name="password" required />
          </label>
          <button type="submit">Anmelden</button>
        </form>
      </div>
    </main>
  );
}
