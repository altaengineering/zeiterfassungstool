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

      return true;
    },
  },
};
