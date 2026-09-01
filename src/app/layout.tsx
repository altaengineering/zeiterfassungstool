import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zeiterfassung – Alta Engineering AG",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>
        <div className="topbar">
          <div className="topbar-inner">
            <Link href="/">Zeiterfassung Alta Engineering AG</Link>
            <span className="tag">Proof of Concept</span>
          </div>
        </div>
        {children}
      </body>
    </html>
  );
}
