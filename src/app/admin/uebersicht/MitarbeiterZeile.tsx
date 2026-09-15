"use client";

import { useState } from "react";
import Link from "next/link";

export interface UebersichtBuchung {
  datum: string;
  label: string;
  hours: number;
  kommentar: string;
}

function formatStunden(h: number): string {
  return h.toFixed(2).replace(/\.00$/, "");
}

export function MitarbeiterZeile({
  userId,
  jahr,
  monat,
  name,
  erfassteTage,
  erwarteteArbeitstage,
  hinterher,
  zeilen,
}: {
  userId: string;
  jahr: number;
  monat: number;
  name: string;
  erfassteTage: number;
  erwarteteArbeitstage: number;
  hinterher: boolean;
  zeilen: UebersichtBuchung[];
}) {
  const [offen, setOffen] = useState(false);

  return (
    <>
      <tr className="uebersicht-zeile" onClick={() => setOffen((v) => !v)}>
        <td className="label-cell">
          <span className="uebersicht-caret">{offen ? "▾" : "▸"}</span> {name}
        </td>
        <td>
          {erfassteTage} / {erwarteteArbeitstage}
        </td>
        <td className="label-cell">
          <span
            className={"uebersicht-status" + (hinterher ? " uebersicht-status-warn" : "")}
          >
            {hinterher ? "im Rückstand" : "auf dem Laufenden"}
          </span>
        </td>
        <td className="label-cell">
          <Link
            href={`/mitarbeiter/${userId}/${jahr}/${monat}`}
            onClick={(e) => e.stopPropagation()}
            className="link-btn-inline"
          >
            Monat öffnen
          </Link>
        </td>
      </tr>
      {offen && (
        <tr className="uebersicht-detail-zeile">
          <td colSpan={4}>
            {zeilen.length > 0 ? (
              <table className="uebersicht-detail-table">
                <thead>
                  <tr>
                    <th>Datum</th>
                    <th className="label-cell">Projekt</th>
                    <th>Stunden</th>
                    <th className="label-cell">Kommentar</th>
                  </tr>
                </thead>
                <tbody>
                  {zeilen.map((z, i) => (
                    <tr key={i}>
                      <td>
                        {z.datum.slice(8, 10)}.{z.datum.slice(5, 7)}.
                      </td>
                      <td className="label-cell">{z.label}</td>
                      <td>{z.hours > 0 ? formatStunden(z.hours) : "—"}</td>
                      <td className="label-cell">{z.kommentar || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="form-hint" style={{ margin: 0 }}>
                Noch keine Einträge in diesem Monat.
              </p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
