import type { NextAuthConfig } from "next-auth";

/**
 * Edge-taugliche Basis-Konfiguration (kein Prisma/bcrypt hier drin — das würde im
 * Middleware-Edge-Runtime nicht laufen). Die eigentlichen Provider kommen in auth.ts dazu,
 * das nur in der Node.js-Runtime (API-Route) verwendet wird.
 */
export const authConfig: NextAuthConfig = {
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    // Muss auch hier (nicht nur in auth.ts) stehen: die Middleware baut ihre eigene NextAuth-
    // Instanz aus authConfig, und ohne diesen Callback fehlen id/role auf auth.user beim
    // Dekodieren des Tokens — das hat den Zugriffs-Check in authorized() fälschlich blockiert.
    jwt({ token, user }) {
      if (user) {
        token.id = (user as { id: string }).id;
        token.role = (user as { role: string }).role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;

      if (pathname.startsWith("/login") || pathname.startsWith("/api/auth")) {
        return true;
      }

      // Next.js prefetcht <Link>s im Hintergrund (z.B. den Home-Link in der Kopfzeile, der auf
      // jeder Seite sichtbar ist). Ein solcher Prefetch-Request lässt sich hier nicht immer
      // zuverlässig einer gültigen Session zuordnen und darf NIE eine echte Navigation auslösen —
      // sonst kann ein Hintergrund-Prefetch den Nutzer mitten in einer Aktion (z.B. Formular-
      // Absenden) fälschlich auf /login werfen. Der eigentliche Zugriffsschutz greift ohnehin bei
      // der echten Navigation/Server Action.
      if (request.headers.get("next-router-prefetch")) {
        return true;
      }

      const isLoggedIn = !!auth?.user;
      if (!isLoggedIn) return false;

      const role = (auth.user as { role?: string }).role;
      const meineId = (auth.user as { id?: string }).id;

      // Mitarbeitende dürfen nur ihre eigene Monatsansicht sehen/bearbeiten, Admin alle.
      const mitarbeiterMatch = pathname.match(/^\/mitarbeiter\/([^/]+)/);
      if (mitarbeiterMatch && role !== "ADMIN" && meineId !== mitarbeiterMatch[1]) {
        return false;
      }

      // Gleiches gilt für den Excel-Export.
      const exportMatch = pathname.match(/^\/api\/export\/([^/]+)/);
      if (exportMatch && role !== "ADMIN" && meineId !== exportMatch[1]) {
        return false;
      }

      // Admin-Bereich (Nutzerverwaltung/Passwort zurücksetzen) nur für Admins.
      if (pathname.startsWith("/admin") && role !== "ADMIN") {
        return false;
      }

      return true;
    },
  },
};
