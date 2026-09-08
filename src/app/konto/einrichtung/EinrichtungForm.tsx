"use client";

import { useActionState } from "react";
import { einrichtungSpeichern, einrichtungZuruecksetzen, type EinrichtungState } from "./actions";

const initialState: EinrichtungState = {};

export function EinrichtungForm({
  defaultDatum,
  defaultStundenSaldo,
  defaultFerienGuthaben,
  istEingerichtet,
}: {
  defaultDatum: string;
  defaultStundenSaldo: number;
  defaultFerienGuthaben: number;
  istEingerichtet: boolean;
}) {
  const [state, formAction, pending] = useActionState(einrichtungSpeichern, initialState);
  const [resetState, resetAction, resetPending] = useActionState(einrichtungZuruecksetzen, initialState);

  return (
    <>
      <form action={formAction}>
        {state.error && <p className="form-message error">{state.error}</p>}
        {state.success && (
          <p className="form-message success">
            Gespeichert. Tage vor dem Startdatum zählen ab sofort nicht mehr mit.
          </p>
        )}
        <label>
          Startdatum (ab wann das Tool für dich zählt)
          <input type="date" name="startdatum" defaultValue={defaultDatum} required />
        </label>
        <label>
          Aktueller Überstunden-Saldo (in Stunden, z.B. 0 oder -5.5)
          <input type="number" step="0.1" name="stundenSaldo" defaultValue={defaultStundenSaldo} required />
        </label>
        <label>
          Aktuelles Ferien-Guthaben (in Tagen)
          <input type="number" step="0.1" name="ferienGuthaben" defaultValue={defaultFerienGuthaben} required />
        </label>
        <button type="submit" disabled={pending}>
          {pending ? "Speichert…" : "Speichern"}
        </button>
      </form>

      {istEingerichtet && (
        <form action={resetAction} style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
          <p className="form-message small">
            Hast du schon echte, lückenlose Tageseinträge (z.B. weil dein Team von einem alten
            Excel übernommen hat) und die Einrichtung war ein Versehen? Dann hier zurücksetzen —
            danach zählen wieder alle erfassten Tage normal, ohne künstliche Nullung davor.
          </p>
          {resetState.error && <p className="form-message error">{resetState.error}</p>}
          {resetState.success && (
            <p className="form-message success">Zurückgesetzt. Lade die Monatsansicht neu, um den korrigierten Stand zu sehen.</p>
          )}
          <button type="submit" className="link-btn-inline" disabled={resetPending}>
            {resetPending ? "Setzt zurück…" : "Einrichtung zurücksetzen"}
          </button>
        </form>
      )}
    </>
  );
}
