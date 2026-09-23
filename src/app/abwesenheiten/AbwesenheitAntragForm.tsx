"use client";

import { useActionState } from "react";
import { ferienBeantragen, type FerienAntragState } from "./actions";

const initialState: FerienAntragState = {};

export function AbwesenheitAntragForm({ heute }: { heute: string }) {
  const [state, formAction, pending] = useActionState(ferienBeantragen, initialState);

  return (
    <form action={formAction} className="entry-form" key={state.success ? "gesendet" : "offen"}>
      {state.error && <p className="form-message error">{state.error}</p>}
      {state.success && (
        <p className="form-message success">
          Antrag gesendet. Du siehst ihn unten mit Status &bdquo;offen&ldquo;, sobald ein Admin
          entscheidet, änderst sich der Status hier automatisch.
        </p>
      )}
      <div className="pill-group">
        <input type="radio" id="typ-ferien" name="typ" value="ferien" defaultChecked />
        <label htmlFor="typ-ferien">🏖️ Ferien (Ferien-Saldo)</label>
        <input type="radio" id="typ-gleitzeit" name="typ" value="gleitzeit" />
        <label htmlFor="typ-gleitzeit">🕑 Gleitzeit (Gleitzeit-Stand)</label>
      </div>
      <label>
        Von
        <input type="date" name="von" defaultValue={heute} required />
      </label>
      <label>
        Bis
        <input type="date" name="bis" defaultValue={heute} required />
      </label>
      <label>
        Kommentar (optional)
        <input type="text" name="kommentar" placeholder="z.B. Grund oder Hinweis für den Admin" />
      </label>
      <button type="submit" disabled={pending}>
        {pending ? "Sendet…" : "Abwesenheit beantragen"}
      </button>
    </form>
  );
}
