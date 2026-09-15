"use client";

import { useState } from "react";
import { projektUmbenennen, projektAktivSchalten, projektLoeschen } from "./actions";

export function ProjektZeile({
  id,
  name,
  aktiv,
  anzahlBuchungen,
}: {
  id: string;
  name: string;
  aktiv: boolean;
  anzahlBuchungen: number;
}) {
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
    <div className={"projekt-card" + (aktiv ? "" : " projekt-card-inaktiv")}>
      <div className="projekt-card-info">
        <span className="projekt-card-icon">📁</span>
        <span className="projekt-card-name">{name}</span>
        <span className="projekt-card-buchungen">
          {anzahlBuchungen} Buchung{anzahlBuchungen === 1 ? "" : "en"}
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
        {!aktiv && (
          <form
            action={projektLoeschen}
            onSubmit={(e) => {
              const frage =
                anzahlBuchungen > 0
                  ? `„${name}" endgültig entfernen? ${anzahlBuchungen} alte Buchung${anzahlBuchungen === 1 ? "" : "en"} bleiben erhalten, verlieren aber die Verknüpfung zu diesem Projekt.`
                  : `„${name}" endgültig entfernen?`;
              if (!confirm(frage)) e.preventDefault();
            }}
          >
            <input type="hidden" name="id" value={id} />
            <button type="submit" className="projekt-card-btn projekt-card-btn-entfernen">
              Entfernen
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
