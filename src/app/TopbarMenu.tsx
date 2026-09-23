"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export function TopbarMenu({
  label,
  accent,
  children,
}: {
  label: string;
  accent?: boolean;
  children: ReactNode;
}) {
  const [offen, setOffen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!offen) return;
    function beiKlickAusserhalb(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOffen(false);
      }
    }
    document.addEventListener("mousedown", beiKlickAusserhalb);
    return () => document.removeEventListener("mousedown", beiKlickAusserhalb);
  }, [offen]);

  return (
    <div className="topbar-menu" ref={wrapperRef}>
      <button
        type="button"
        className={"topbar-menu-trigger" + (accent ? " topbar-menu-trigger-accent" : "")}
        onClick={() => setOffen((v) => !v)}
        aria-expanded={offen}
      >
        {label}
        <span className="topbar-menu-caret">{offen ? "▴" : "▾"}</span>
      </button>
      {offen && (
        <div
          className="topbar-menu-panel"
          onClick={() => {
            // setTimeout statt direktem setOffen(false): ein Klick auf einen echten
            // Formular-Submit-Button (z.B. "Abmelden", src/app/layout.tsx) loest neben diesem
            // React-onClick auch die native Formular-Submission als Default-Action aus. React
            // entfernt {offen && ...} inklusive Formular synchron aus dem DOM, sobald setOffen(false)
            // im selben Tick laeuft, dadurch feuert die native Submission nie (Bug: Abmelden tat
            // nichts, lokal reproduziert). Mit setTimeout(...,0) laeuft die native Default-Action
            // zuerst, das Schliessen des Menüs einen Tick spaeter faellt nicht auf.
            setTimeout(() => setOffen(false), 0);
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
