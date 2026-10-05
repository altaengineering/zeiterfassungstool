"use client";

import { useActionState, useRef } from "react";
import { nutzerHinzufuegen, type NeuerNutzerState } from "./actions";

const initialState: NeuerNutzerState = {};

export function AddUserForm() {
  const [state, formAction, pending] = useActionState(nutzerHinzufuegen, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="entry-form-card" style={{ marginBottom: 24 }}>
      <form
        ref={formRef}
        action={async (fd) => {
          await formAction(fd);
          formRef.current?.reset();
        }}
        className="entry-form"
      >
        <div className="form-section-title">Neue:n Mitarbeitende:n hinzufügen</div>
        {state.error && <p className="form-message error">{state.error}</p>}
        {state.neuesPasswort && (
          <p className="form-message success">
            Angelegt: {state.email} — Passwort: <code>{state.neuesPasswort}</code>
            <br />
            Jetzt sicher weitergeben — wird nicht nochmal angezeigt.
          </p>
        )}
        <div className="form-grid">
          <label>
            Name
            <input type="text" name="name" placeholder="Vorname Nachname" required />
          </label>
          <label>
            E-Mail
            <input type="email" name="email" placeholder="v.nachname@alta-engineering.ch" required />
          </label>
          <label>
            Anstellung %
            <input type="number" name="anstellungPct" defaultValue={100} min={1} max={100} required />
          </label>
          <label>
            Wochenstunden
            <input type="number" name="wochenstunden" defaultValue={42} step="0.1" required />
          </label>
          <label>
            Rolle
            <select name="rolle" defaultValue="MITARBEITER">
              <option value="MITARBEITER">Mitarbeiter</option>
              <option value="ADMIN">Admin</option>
            </select>
          </label>
        </div>
        <div className="entry-form-footer">
          <button type="submit" disabled={pending}>
            {pending ? "Wird angelegt…" : "Mitarbeiter:in anlegen"}
          </button>
        </div>
      </form>
    </div>
  );
}
