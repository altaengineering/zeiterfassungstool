import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { auth, signOut } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Zeiterfassung – Alta Engineering AG",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <html lang="de">
      <body>
        <div className="topbar">
          <div className="topbar-inner">
            <Link href="/">Zeiterfassung Alta Engineering AG</Link>
            <span className="tag">Proof of Concept</span>
            {session?.user && (
              <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
                <span>{session.user.name}</span>
                <form
                  action={async () => {
                    "use server";
                    await signOut({ redirectTo: "/login" });
                  }}
                >
                  <button
                    type="submit"
                    style={{
                      background: "none",
                      border: "1px solid rgba(255,255,255,0.4)",
                      color: "#fff",
                      borderRadius: 6,
                      padding: "3px 10px",
                      fontSize: "0.8rem",
                      cursor: "pointer",
                    }}
                  >
                    Abmelden
                  </button>
                </form>
              </span>
            )}
          </div>
        </div>
        {children}
      </body>
    </html>
  );
}
