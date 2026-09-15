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
        <div className="topbar-menu-panel" onClick={() => setOffen(false)}>
          {children}
        </div>
      )}
    </div>
  );
}
