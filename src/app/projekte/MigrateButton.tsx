"use client";

import { useActionState } from "react";
import { alteBuchungenMigrieren, type MigrateState } from "./actions";

const initialState: MigrateState = {};

export function MigrateButton() {
  const [state, formAction, pending] = useActionState(alteBuchungenMigrieren, initialState);

  return (
    <div className="migrate-box">
      <form action={formAction}>
        <button type="submit" className="migrate-btn" disabled={pending}>
          {pending ? "Wird übernommen…" : "Ja, alte Einträge jetzt übernehmen"}
        </button>
      </form>
      {state.anzahl !== undefined && (
        <p className={"migrate-result" + (state.anzahl === 0 ? " migrate-result-neutral" : "")}>
          {state.anzahl === 0
            ? "Alles schon erledigt, nichts Neues gefunden."
            : `Fertig: ${state.anzahl} alte Buchung${state.anzahl === 1 ? "" : "en"} übernommen.`}
        </p>
      )}
    </div>
  );
}
