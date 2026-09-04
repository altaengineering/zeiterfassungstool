"use client";

import { useRef, useState } from "react";
import { tageseintragSpeichern } from "./actions";

export function EntryForm({
  userId,
  jahr,
  monat,
  defaultDatum,
}: {
  userId: string;
  jahr: number;
  monat: number;
  defaultDatum: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [weitereZeitbloecke, setWeitereZeitbloecke] = useState(false);

  return (
    <div className="entry-form-card">
      <form
        ref={formRef}
        action={async (formData) => {
          await tageseintragSpeichern(formData);
          formRef.current?.reset();
          setWeitereZeitbloecke(false);
        }}
      >
        <input type="hidden" name="userId" value={userId} />
        <input type="hidden" name="jahr" value={jahr} />
        <input type="hidden" name="monat" value={monat} />

        <div className="datum-bar">
          <label>
            Datum
            <input type="date" name="datum" defaultValue={defaultDatum} required />
          </label>
          <span className="override-hint">
            Soll-Override nur bei Sonderfällen nötig (unten, normalerweise leer lassen)
          </span>
        </div>

        <div className="entry-form">
          <div className="form-section">
            <div className="form-section-title">Projekte</div>
            <div className="form-row-pair">
              <label>
                Projekt 1 – Name
                <input type="text" name="projektLabel1" placeholder="z.B. Raytech AG" />
              </label>
              <label>
                Stunden
                <input type="number" step="0.25" name="projektStunden1" />
              </label>
            </div>
            <div className="form-row-pair">
              <label>
                Projekt 2 – Name
                <input type="text" name="projektLabel2" placeholder="optional" />
              </label>
              <label>
                Stunden
                <input type="number" step="0.25" name="projektStunden2" />
              </label>
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-title">Kategorien</div>
            <div className="form-grid">
              <label>
                Krank
                <input type="number" step="0.25" name="krank" defaultValue={0} />
              </label>
              <label>
                Reisezeit
                <input type="number" step="0.25" name="reisezeit" defaultValue={0} />
              </label>
              <label>
                CAD
                <input type="number" step="0.25" name="cad" defaultValue={0} />
              </label>
              <label>
                Ausbildung
                <input type="number" step="0.25" name="ausbildung" defaultValue={0} />
              </label>
              <label>
                Büro
                <input type="number" step="0.25" name="buero" defaultValue={0} />
              </label>
              <label>
                Ferien
                <input type="number" step="0.25" name="ferien" defaultValue={0} />
              </label>
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-title">Stempelzeiten</div>
            <div className="zeitbloecke-grid">
              <div className="zeit-paar">
                <label>
                  Start 1
                  <input type="time" name="start1" />
                </label>
                <label>
                  Stop 1
                  <input type="time" name="stop1" />
                </label>
              </div>
              <div className="zeit-paar">
                <label>
                  Start 2
                  <input type="time" name="start2" />
                </label>
                <label>
                  Stop 2
                  <input type="time" name="stop2" />
                </label>
              </div>
              {weitereZeitbloecke && (
                <>
                  <div className="zeit-paar">
                    <label>
                      Start 3
                      <input type="time" name="start3" />
                    </label>
                    <label>
                      Stop 3
                      <input type="time" name="stop3" />
                    </label>
                  </div>
                  <div className="zeit-paar">
                    <label>
                      Start 4
                      <input type="time" name="start4" />
                    </label>
                    <label>
                      Stop 4
                      <input type="time" name="stop4" />
                    </label>
                  </div>
                </>
              )}
            </div>
            {!weitereZeitbloecke && (
              <button
                type="button"
                className="zeitbloecke-toggle"
                onClick={() => setWeitereZeitbloecke(true)}
              >
                + weitere Zeitblöcke (3./4.)
              </button>
            )}
          </div>

          <div className="form-section">
            <div className="form-section-title">Spesen &amp; Sonstiges</div>
            <div className="form-grid">
              <label>
                Spesen (Fr.)
                <input type="number" step="0.05" name="spesenFr" defaultValue={0} />
              </label>
              <label>
                Km
                <input type="number" step="1" name="km" defaultValue={0} />
              </label>
              <label>
                Soll-Override (h)
                <input type="number" step="0.1" name="sollOverride" placeholder="leer = automatisch" />
              </label>
            </div>
          </div>

          <div className="entry-form-footer">
            <button type="submit">Tag speichern</button>
          </div>
        </div>
      </form>
    </div>
  );
}
