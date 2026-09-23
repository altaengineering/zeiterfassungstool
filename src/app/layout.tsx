import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/db";
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
  const userId = (session?.user as { id?: string } | undefined)?.id;

  // Einmalig erscheinender Hinweis, bis die Person ihre Einrichtung ausgefuellt hat (Startdatum,
  // Ferien-Guthaben, Jahresferientage). erfassungStartDatum ist genau dafuer schon ein
  // zuverlaessiger Marker: bleibt NULL bis zum ersten Speichern der Einrichtung (siehe
  // einrichtungZuruecksetzen fuer den einzigen Weg, es wieder auf NULL zu setzen), kein separates
  // Feld noetig. Im Layout statt einzeln pro Seite, damit der Hinweis ueberall erscheint, nicht
  // nur auf einer Unterseite, die man zufaellig zuerst besucht.
  let brauchtEinrichtung = false;
  if (userId) {
    const jahr = new Date().getFullYear();
    const stammdaten = await prisma.jahresStammdaten.findUnique({
      where: { userId_year: { userId, year: jahr } },
    });
    brauchtEinrichtung = stammdaten != null && stammdaten.erfassungStartDatum == null;
  }

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
        <div className="app-bg" aria-hidden="true" />
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
                  <Link href="/abwesenheiten">Abwesenheiten</Link>
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
        {brauchtEinrichtung && (
          <div className="einrichtung-hinweis">
            <div className="einrichtung-hinweis-inner">
              <span>
                📅 Bevor dein Ferien-Saldo stimmt: trag einmalig dein aktuelles Ferien-Guthaben und
                deinen Jahresanspruch ein.
              </span>
              <Link href="/konto/einrichtung" className="einrichtung-hinweis-link">
                Jetzt einrichten →
              </Link>
            </div>
          </div>
        )}
        {children}
      </body>
    </html>
  );
}
