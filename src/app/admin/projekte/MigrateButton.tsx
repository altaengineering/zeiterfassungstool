"use client";

import { useActionState } from "react";
import { alteBuchungenMigrieren, type MigrateState } from "./actions";

const initialState: MigrateState = {};

export function MigrateButton() {
  const [state, formAction, pending] = useActionState(alteBuchungenMigrieren, initialState);

  return (
    <div>
      <form action={formAction}>
        <button type="submit" className="link-btn-inline" disabled={pending}>
          {pending ? "…" : "Alte Buchungen (freier Text) einmalig übernehmen"}
        </button>
      </form>
      {state.anzahl !== undefined && (
        <p className="form-message success small">
          {state.anzahl === 0
            ? "Keine offenen Altbuchungen gefunden, alles bereits verknüpft."
            : `${state.anzahl} Buchung(en) verknüpft.`}
        </p>
      )}
    </div>
  );
}
