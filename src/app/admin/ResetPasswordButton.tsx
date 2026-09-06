"use client";

import { useActionState } from "react";
import { passwortZuruecksetzen, type ResetState } from "./actions";

const initialState: ResetState = {};

export function ResetPasswordButton({ userId, name }: { userId: string; name: string }) {
  const [state, formAction, pending] = useActionState(passwortZuruecksetzen, initialState);

  return (
    <div>
      <form action={formAction}>
        <input type="hidden" name="userId" value={userId} />
        <button
          type="submit"
          className="link-btn-inline"
          disabled={pending}
          onClick={(e) => {
            if (!confirm(`Passwort von ${name} wirklich zurücksetzen?`)) {
              e.preventDefault();
            }
          }}
        >
          {pending ? "…" : "Passwort zurücksetzen"}
        </button>
      </form>
      {state.error && <p className="form-message error small">{state.error}</p>}
      {state.neuesPasswort && (
        <p className="form-message success small">
          Neues Passwort für {name}: <code>{state.neuesPasswort}</code>
          <br />
          Jetzt sicher weitergeben — wird nicht nochmal angezeigt.
        </p>
      )}
    </div>
  );
}
