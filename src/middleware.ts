import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

export const { auth: middleware } = NextAuth(authConfig);
export default middleware;

export const config = {
  // Alles ausser statischen Assets prüfen (auch Server-Action-POSTs treffen dieselbe Route-URL).
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
