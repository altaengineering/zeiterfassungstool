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

  // Einmalig erscheinender Hinweis, bis die Person ihr Ferien-Guthaben und ihren Jahresanspruch
  // eingetragen hat. Eigener Marker (ferienEinrichtungErledigt), bewusst GETRENNT von der grossen
  // "leere Startphase"-Einrichtung (Startdatum/Ueberstunden, siehe konto/einrichtung) — der Hinweis
  // verlinkt daher auf eine eigene, kleine Seite mit nur den zwei Ferien-Feldern statt auf die
  // grosse Einrichtungsseite. Im Layout statt einzeln pro Seite, damit der Hinweis ueberall
  // erscheint, nicht nur auf einer Unterseite, die man zufaellig zuerst besucht.
  let brauchtFerienEinrichtung = false;
  if (userId) {
    const jahr = new Date().getFullYear();
    const stammdaten = await prisma.jahresStammdaten.findUnique({
      where: { userId_year: { userId, year: jahr } },
    });
    brauchtFerienEinrichtung = stammdaten != null && !stammdaten.ferienEinrichtungErledigt;
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
        <div className="app-bg" aria-hidden="true">
          <svg className="app-bg-traces" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
            <defs>
              {/* Grosse Kachel (400px), das eigentliche Leiterbahn-Motiv belegt nur die linke obere
                  Ecke davon — der Rest der Kachel bleibt leer. Das haelt den Abstand zwischen den
                  Wiederholungen gross, ohne die Pfade selbst neu vermessen zu muessen (Feedback
                  2026-09-23: erster Versuch war "viel zu heftig"/wie Tapete, nicht subtil). */}
              <pattern id="pcb-pattern" width="400" height="400" patternUnits="userSpaceOnUse">
                <path className="pcb-trace" d="M0 40 H50 L60 50 V90 H130" />
                <path className="pcb-trace" d="M100 0 V30 L110 40 H160" />
                <path className="pcb-trace" d="M20 160 V120 L30 110 H90 L100 120 V160" />
                <path className="pcb-trace" d="M160 100 H140 L130 90 V60" />
                <path className="pcb-trace" d="M0 130 H30" />
                <circle className="pcb-via" cx="60" cy="50" r="2.2" />
                <circle className="pcb-via" cx="130" cy="90" r="2.2" />
                <circle className="pcb-via" cx="110" cy="40" r="2.2" />
                <circle className="pcb-via" cx="30" cy="110" r="2.2" />
                <circle className="pcb-via" cx="100" cy="120" r="2.2" />
                <circle className="pcb-pad" cx="0" cy="40" r="3" />
                <circle className="pcb-pad" cx="160" cy="100" r="3" />
                <circle className="pcb-pad" cx="30" cy="160" r="3" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#pcb-pattern)" />
          </svg>
        </div>
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
                  <Link href="/konto/ferien-einrichtung" className="topbar-menu-item">
                    Ferien-Einrichtung
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
        {brauchtFerienEinrichtung && (
          <div className="einrichtung-hinweis">
            <div className="einrichtung-hinweis-inner">
              <span>
                📅 Bevor dein Ferien-Saldo stimmt: trag einmalig dein aktuelles Ferien-Guthaben und
                deinen Jahresanspruch ein.
              </span>
              <Link href="/konto/ferien-einrichtung" className="einrichtung-hinweis-link">
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
