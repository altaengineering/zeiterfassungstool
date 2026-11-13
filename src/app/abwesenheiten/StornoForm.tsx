"use client";

import { useActionState } from "react";
import { abwesenheitStornieren, type StornoState } from "./actions";

const initialState: StornoState = {};

export function StornoForm({ antragId, von, bis }: { antragId: string; von: string; bis: string }) {
  const [state, formAction, pending] = useActionState(abwesenheitStornieren, initialState);

  return (
    <details className="storno-details">
      <summary className="link-btn-inline">Stornieren…</summary>
      <form
        action={formAction}
        className="entry-form"
        onSubmit={(e) => {
          if (!window.confirm("Diese Abwesenheit im gewählten Zeitraum wirklich stornieren?")) e.preventDefault();
        }}
      >
        <input type="hidden" name="antragId" value={antragId} />
        <p className="form-hint">
          Ganzen Antrag stornieren oder nur einen Teil davon (z.B. einzelne Tage). Die Tage
          werden wieder freigegeben: Ferien/Gleitzeit zählen dafür nicht mehr.
        </p>
        <label>
          Stornieren von
          <input type="date" name="von" defaultValue={von} min={von} max={bis} required />
        </label>
        <label>
          Stornieren bis
          <input type="date" name="bis" defaultValue={bis} min={von} max={bis} required />
        </label>
        <button type="submit" disabled={pending}>
          {pending ? "Storniert…" : "Stornieren"}
        </button>
        {state.error && <p className="form-message error">{state.error}</p>}
        {state.erfolg && <p className="form-message success">{state.erfolg}</p>}
      </form>
    </details>
  );
}
