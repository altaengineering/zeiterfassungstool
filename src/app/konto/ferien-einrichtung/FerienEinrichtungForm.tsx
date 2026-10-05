"use client";

import { useActionState } from "react";
import { ferienEinrichtungSpeichern, type FerienEinrichtungState } from "./actions";

const initialState: FerienEinrichtungState = {};

export function FerienEinrichtungForm({
  defaultAktuellerSaldo,
  defaultJahresferientage,
  standardJahresferientage,
}: {
  defaultAktuellerSaldo: number;
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
        Wie viele Ferientage hast du JETZT insgesamt noch? (dein aktueller Gesamtsaldo)
        <input type="number" step="0.1" name="aktuellerSaldo" defaultValue={defaultAktuellerSaldo} required />
      </label>
      <p className="form-message small">
        Nicht der Übertrag aus dem Vorjahr, sondern dein Saldo genau jetzt in diesem Moment — bereits
        bezogene Tage dieses Jahr und dein anteiliger Jahresanspruch rechnet das Tool selbst dazu.
      </p>
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
