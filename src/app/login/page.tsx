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
    <main className="login-hero">
      <section className="login-brand">
        <div className="login-brand-content">
          <div className="login-mark">
            <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="32" cy="32" r="27" stroke="#5b9bf0" strokeWidth="2.5" />
              {Array.from({ length: 12 }).map((_, i) => {
                const winkel = (i * 30 * Math.PI) / 180;
                const x1 = 32 + Math.cos(winkel) * 22;
                const y1 = 32 + Math.sin(winkel) * 22;
                const x2 = 32 + Math.cos(winkel) * 27;
                const y2 = 32 + Math.sin(winkel) * 27;
                return (
                  <line
                    key={i}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="#5b9bf0"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                );
              })}
              <line x1="32" y1="32" x2="44" y2="20" stroke="#ffb020" strokeWidth="3" strokeLinecap="round" />
              <circle cx="32" cy="32" r="4" fill="#ffb020" />
            </svg>
            <span className="login-wordmark">
              Alta Engineering
              <small>Zeiterfassung</small>
            </span>
          </div>

          <h1>Präzision beginnt mit der Zeit.</h1>
          <p>
            Die digitale Zeiterfassung von Alta Engineering AG — direkt erfasst, automatisch
            berechnet, immer aktuell. Kein Excel-Upload mehr.
          </p>

          <div className="login-stats">
            <div>
              <strong>14</strong>
              <span>Mitarbeitende</span>
            </div>
            <div>
              <strong>100%</strong>
              <span>Digital</span>
            </div>
            <div>
              <strong>0</strong>
              <span>Excel-Uploads</span>
            </div>
          </div>
        </div>
      </section>

      <section className="login-form-side">
        <div className="login-form-card">
          <h2>Anmelden</h2>
          <span className="muted">Melde dich mit deinen Zugangsdaten an.</span>
          <form action={login}>
            {error && <p className="form-message error">E-Mail oder Passwort falsch.</p>}
            <label>
              E-Mail
              <input type="email" name="email" required autoFocus placeholder="vorname.nachname@alta-engineering.ch" />
            </label>
            <label>
              Passwort
              <input type="password" name="password" required />
            </label>
            <button type="submit">Anmelden</button>
          </form>
        </div>
      </section>
    </main>
  );
}
