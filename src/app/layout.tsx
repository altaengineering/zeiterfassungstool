import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { auth, signOut } from "@/lib/auth";
import { ThemeToggle } from "./ThemeToggle";

export const metadata: Metadata = {
  title: "Zeiterfassung – Alta Engineering AG",
};

// Verhindert einen kurzen Hell/Dunkel-"Flash" beim Laden: setzt data-theme synchron, bevor
// irgendetwas gemalt wird — noch bevor React/Hydration überhaupt läuft.
const themeInitScript = `
(function () {
  try {
    var gespeichert = localStorage.getItem("theme");
    if (gespeichert === "dark" || gespeichert === "light") {
      document.documentElement.setAttribute("data-theme", gespeichert);
    }
  } catch (e) {}
})();
`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const istAdmin = (session?.user as { role?: string } | undefined)?.role === "ADMIN";

  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <div className="topbar">
          <div className="topbar-inner">
            <Link href="/">Zeiterfassung Alta Engineering AG</Link>
            {session?.user && (
              <span className="topbar-user">
                {istAdmin && <Link href="/admin">Nutzerverwaltung</Link>}
                {istAdmin && <Link href="/admin/feiertage">Feiertage</Link>}
                {istAdmin && <Link href="/admin/monatsabschluss">Monatsabschluss</Link>}
                <Link href="/konto/passwort">Passwort ändern</Link>
                <Link href="/konto/einrichtung">Einrichtung</Link>
                <span>{session.user.name}</span>
                <ThemeToggle />
                <form
                  action={async () => {
                    "use server";
                    await signOut({ redirectTo: "/login" });
                  }}
                >
                  <button type="submit" className="link-btn">
                    Abmelden
                  </button>
                </form>
              </span>
            )}
            {!session?.user && (
              <span className="topbar-user">
                <ThemeToggle />
              </span>
            )}
          </div>
        </div>
        {children}
      </body>
    </html>
  );
}
