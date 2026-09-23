"use client";

import { useActionState } from "react";
import { ferienEinrichtungSpeichern, type FerienEinrichtungState } from "./actions";

const initialState: FerienEinrichtungState = {};

export function FerienEinrichtungForm({
  defaultFerienGuthaben,
  defaultJahresferientage,
  standardJahresferientage,
}: {
  defaultFerienGuthaben: number;
  defaultJahresferientage: number | null;
  standardJahresferientage: number;
}) {
  const [state, formAction, pending] = useActionState(ferienEinrichtungSpeichern, initialState);

  return (
    <form action={formAction} className="entry-form">
      {state.error && <p className="form-message error">{state.error}</p>}
      {state.success && (
        <p className="form-message success">Gespeichert. Dein Ferien-Saldo stimmt jetzt.</p>
      )}
      <label>
        Aktuelles Ferien-Guthaben (in Tagen)
        <input type="number" step="0.1" name="ferienGuthaben" defaultValue={defaultFerienGuthaben} required />
      </label>
      <label>
        Ferientage pro Jahr laut Vertrag (nur ausfüllen, falls abweichend vom Standard)
        <input
          type="number"
          step="0.1"
          name="jahresferientage"
          defaultValue={defaultJahresferientage ?? ""}
          placeholder={`Standard: ${standardJahresferientage.toFixed(1)} Tage/Jahr`}
        />
      </label>
      <p className="form-message small">
        Leer lassen für den Firmenstandard ({standardJahresferientage.toFixed(1)} Tage/Jahr bei
        Vollzeit).
      </p>
      <button type="submit" disabled={pending}>
        {pending ? "Speichert…" : "Speichern"}
      </button>
    </form>
  );
}
