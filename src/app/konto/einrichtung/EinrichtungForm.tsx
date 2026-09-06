"use client";

import { useActionState } from "react";
import { einrichtungSpeichern, type EinrichtungState } from "./actions";

const initialState: EinrichtungState = {};

export function EinrichtungForm({ defaultDatum }: { defaultDatum: string }) {
  const [state, formAction, pending] = useActionState(einrichtungSpeichern, initialState);

  return (
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
        <input type="number" step="0.1" name="stundenSaldo" defaultValue={0} required />
      </label>
      <label>
        Aktuelles Ferien-Guthaben (in Tagen)
        <input type="number" step="0.1" name="ferienGuthaben" defaultValue={0} required />
      </label>
      <button type="submit" disabled={pending}>
        {pending ? "Speichert…" : "Speichern"}
      </button>
    </form>
  );
}
