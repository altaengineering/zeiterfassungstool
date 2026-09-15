import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { auth, signOut } from "@/lib/auth";
import { ThemeToggle } from "./ThemeToggle";
import { TopbarMenu } from "./TopbarMenu";

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

  const abmeldenForm = (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/login" });
      }}
    >
      <button type="submit" className="topbar-menu-item topbar-menu-item-btn">
        Abmelden
      </button>
    </form>
  );

  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <div className="topbar">
          <div className="topbar-inner">
            <Link href="/" className="topbar-brand">
              <img src="/alta-logo.png" alt="Alta Engineering AG" className="topbar-logo" />
              <span className="topbar-brand-text">Zeiterfassung</span>
            </Link>
            {session?.user && (
              <span className="topbar-user">
                <nav className="topbar-nav">
                  <Link href="/kalender">Kalender</Link>
                  <Link href="/projekte">Projekte</Link>
                  {istAdmin && (
                    <TopbarMenu label="Admin" accent>
                      <Link href="/admin" className="topbar-menu-item">
                        Nutzerverwaltung
                      </Link>
                      <Link href="/admin/uebersicht" className="topbar-menu-item">
                        Chef-Übersicht
                      </Link>
                      <Link href="/admin/feiertage" className="topbar-menu-item">
                        Feiertage
                      </Link>
                      <Link href="/admin/monatsabschluss" className="topbar-menu-item">
                        Monatsabschluss
                      </Link>
                    </TopbarMenu>
                  )}
                </nav>
                <TopbarMenu label={session.user.name ?? "Konto"}>
                  <Link href="/konto/passwort" className="topbar-menu-item">
                    Passwort ändern
                  </Link>
                  <Link href="/konto/einrichtung" className="topbar-menu-item">
                    Einrichtung
                  </Link>
                  {abmeldenForm}
                </TopbarMenu>
                <ThemeToggle />
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
