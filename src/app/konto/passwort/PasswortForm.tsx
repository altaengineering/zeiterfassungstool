"use client";

import { useActionState, useRef, useEffect } from "react";
import { passwortAendern, type PasswortState } from "./actions";

const initialState: PasswortState = {};

export function PasswortForm() {
  const [state, formAction, pending] = useActionState(passwortAendern, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction}>
      {state.error && <p className="form-message error">{state.error}</p>}
      {state.success && <p className="form-message success">Passwort erfolgreich geändert.</p>}
      <label>
        Aktuelles Passwort
        <input type="password" name="aktuelles" required autoFocus />
      </label>
      <label>
        Neues Passwort
        <input type="password" name="neues" required minLength={8} />
      </label>
      <label>
        Neues Passwort wiederholen
        <input type="password" name="wiederholung" required minLength={8} />
      </label>
      <button type="submit" disabled={pending}>
        {pending ? "Speichert…" : "Passwort speichern"}
      </button>
    </form>
  );
}
