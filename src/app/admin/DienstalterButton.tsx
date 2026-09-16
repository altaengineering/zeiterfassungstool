"use client";

import { useActionState } from "react";
import { dienstalterImportieren, type DienstalterState } from "./actions";

const initialState: DienstalterState = {};

export function DienstalterButton() {
  const [state, formAction, pending] = useActionState(dienstalterImportieren, initialState);

  return (
    <div>
      <form action={formAction}>
        <button type="submit" className="link-btn-inline" disabled={pending}>
          {pending ? "…" : "Dienstalter importieren"}
        </button>
      </form>
      {state.anzahlAktualisiert !== undefined && (
        <p className="form-message success small">
          {state.anzahlAktualisiert} Person(en) aktualisiert.
          {state.unbekannteEmails && state.unbekannteEmails.length > 0 && (
            <>
              <br />
              Keine Übereinstimmung für: {state.unbekannteEmails.join(", ")}
            </>
          )}
        </p>
      )}
    </div>
  );
}
