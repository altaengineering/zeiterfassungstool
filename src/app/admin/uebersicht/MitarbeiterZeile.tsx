"use client";

import { useState } from "react";
import Link from "next/link";
import { initialen } from "@/lib/colors";
import type { FerienSaldo } from "@/lib/ferienSaldo";

export interface UebersichtBuchung {
  datum: string;
  label: string;
  hours: number;
  kommentar: string;
}

function formatStunden(h: number): string {
  return h.toFixed(2).replace(/\.00$/, "");
}

function formatStandDelta(delta: number): string {
  const vorzeichen = delta > 0 ? "+" : "";
  return `${vorzeichen}${formatStunden(delta)}`;
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
  standEndeMonat,
  standVeraenderung,
  ferienSaldo,
  krankTageJahr,
  statistikJahr,
}: {
  userId: string;
  jahr: number;
  monat: number;
  name: string;
  erfassteTage: number;
  erwarteteArbeitstage: number;
  hinterher: boolean;
  zeilen: UebersichtBuchung[];
  standEndeMonat: number | null;
  standVeraenderung: number | null;
  ferienSaldo: FerienSaldo | null;
  krankTageJahr: number;
  statistikJahr: number;
}) {
  const [offen, setOffen] = useState(false);

  return (
    <>
      <tr className="uebersicht-zeile" onClick={() => setOffen((v) => !v)}>
        <td className="label-cell">
          <span className="uebersicht-name">
            <span className="uebersicht-caret">{offen ? "▾" : "▸"}</span>
            <span className="avatar">{initialen(name)}</span>
            {name}
          </span>
        </td>
        <td title={`${erfassteTage} von ${erwarteteArbeitstage} erwarteten Arbeitstagen erfasst`}>
          {erfassteTage} / {erwarteteArbeitstage}
        </td>
        <td className="label-cell">
          <span
            className={"uebersicht-status" + (hinterher ? " uebersicht-status-warn" : "")}
            title={
              hinterher
                ? `Hat weniger Tage erfasst als bis gestern erwartet (${erfassteTage} von ${erwarteteArbeitstage}). Zählt nur Arbeitstage ohne Wochenenden/Feiertage, heute selbst zählt noch nicht mit.`
                : "Hat bis gestern alle erwarteten Arbeitstage erfasst."
            }
          >
            {hinterher ? "im Rückstand" : "auf dem Laufenden"}
          </span>
        </td>
        <td className="label-cell">
          {standEndeMonat !== null ? (
            <span className="uebersicht-gleitzeit">
              <strong className={standEndeMonat < 0 ? "neg" : "pos"}>
                {formatStunden(standEndeMonat)} h
              </strong>
              {standVeraenderung !== null && Math.abs(standVeraenderung) > 0.01 && (
                <span
                  className={"uebersicht-trend " + (standVeraenderung > 0 ? "uebersicht-trend-auf" : "uebersicht-trend-ab")}
                  title={`${formatStandDelta(standVeraenderung)} h seit Monatsbeginn`}
                >
                  {standVeraenderung > 0 ? "▲" : "▼"} {formatStandDelta(standVeraenderung)} h
                </span>
              )}
            </span>
          ) : (
            "—"
          )}
        </td>
        <td
          title={
            ferienSaldo
              ? `${ferienSaldo.ferienBezogen.toFixed(1)} von ${ferienSaldo.ferienGuthaben.toFixed(1)} Tagen bereits bezogen`
              : undefined
          }
        >
          {ferienSaldo !== null ? (
            <span className={ferienSaldo.ferienUebertrag < 0 ? "neg" : undefined}>
              {ferienSaldo.ferienUebertrag.toFixed(1)} Tage
            </span>
          ) : (
            "—"
          )}
        </td>
        <td className={krankTageJahr > 0 ? undefined : "muted"} title={`${krankTageJahr} Kranktage seit 1.1.${statistikJahr}`}>
          {krankTageJahr}
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
          <td colSpan={7}>
            {zeilen.length > 0 ? (
              <table className="uebersicht-detail-table">
                <colgroup>
                  <col className="uebersicht-col-datum" />
                  <col className="uebersicht-col-projekt" />
                  <col className="uebersicht-col-stunden" />
                  <col className="uebersicht-col-kommentar" />
                </colgroup>
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
                      <td className="label-cell">
                        {z.label !== "—" ? (
                          <span className="tag">{z.label}</span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>{z.hours > 0 ? formatStunden(z.hours) : "—"}</td>
                      <td className="label-cell uebersicht-kommentar">{z.kommentar || "—"}</td>
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
