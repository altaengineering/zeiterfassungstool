import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

export const { auth: middleware } = NextAuth(authConfig);
export default middleware;

export const config = {
  // Alles ausser statischen Assets prüfen (auch Server-Action-POSTs treffen dieselbe Route-URL).
  // Der Dateiendungs-Ausschluss deckt auch alles unter public/ ab (z.B. alta-logo.png): ohne ihn
  // griff die Middleware bisher auch dort, ein noch nicht eingeloggter Aufruf der Login-Seite
  // schickte die Logo-Anfrage selbst wieder auf /login um, statt das Bild zu liefern, das Logo
  // erschien kaputt (nur bei bereits bestehender Session lief die Anfrage einfach durch, deshalb
  // beim eigenen Testen mit angemeldetem Browser nie aufgefallen).
  // api/cron/ ebenfalls ausgeschlossen: Vercel Cron schickt keine Session-Cookie, nur einen
  // Authorization-Bearer-Header (siehe api/cron/erinnerung/route.ts), diese Middleware hätte den
  // Request sonst schon vorher auf /login umgeleitet, bevor die Route ihre eigene Prüfung sieht.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/cron/|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)"],
};
