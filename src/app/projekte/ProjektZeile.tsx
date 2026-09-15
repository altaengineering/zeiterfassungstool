"use client";

import { useState } from "react";
import { projektUmbenennen, projektAktivSchalten } from "./actions";

export function ProjektZeile({ id, name, aktiv }: { id: string; name: string; aktiv: boolean }) {
  const [bearbeiten, setBearbeiten] = useState(false);

  if (bearbeiten) {
    return (
      <form
        className="projekt-card projekt-card-bearbeiten"
        action={async (formData) => {
          await projektUmbenennen(formData);
          setBearbeiten(false);
        }}
      >
        <input type="hidden" name="id" value={id} />
        <input
          type="text"
          name="name"
          defaultValue={name}
          autoFocus
          className="projekt-card-input"
        />
        <div className="projekt-card-aktionen">
          <button type="submit" className="projekt-card-btn projekt-card-btn-primary">
            Speichern
          </button>
          <button type="button" className="projekt-card-btn" onClick={() => setBearbeiten(false)}>
            Abbrechen
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="projekt-card">
      <div className="projekt-card-info">
        <span className="projekt-card-name">{name}</span>
        <span className={"projekt-card-status" + (aktiv ? "" : " projekt-card-status-inaktiv")}>
          {aktiv ? "aktiv" : "deaktiviert"}
        </span>
      </div>
      <div className="projekt-card-aktionen">
        <button type="button" className="projekt-card-btn" onClick={() => setBearbeiten(true)}>
          Umbenennen
        </button>
        <form action={projektAktivSchalten}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="aktiv" value={String(aktiv)} />
          <button type="submit" className="projekt-card-btn">
            {aktiv ? "Deaktivieren" : "Aktivieren"}
          </button>
        </form>
      </div>
    </div>
  );
}
