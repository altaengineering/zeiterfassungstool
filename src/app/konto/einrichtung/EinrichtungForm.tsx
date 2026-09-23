"use client";

import { useActionState } from "react";
import { einrichtungSpeichern, einrichtungZuruecksetzen, type EinrichtungState } from "./actions";

const initialState: EinrichtungState = {};

export function EinrichtungForm({
  defaultDatum,
  defaultStundenSaldo,
  defaultFerienGuthaben,
  defaultJahresferientage,
  standardJahresferientage,
  defaultFerienBezogenKorrektur,
  istEingerichtet,
}: {
  defaultDatum: string;
  defaultStundenSaldo: number;
  defaultFerienGuthaben: number;
  defaultJahresferientage: number | null;
  standardJahresferientage: number;
  defaultFerienBezogenKorrektur: number;
  istEingerichtet: boolean;
}) {
  const [state, formAction, pending] = useActionState(einrichtungSpeichern, initialState);
  const [resetState, resetAction, resetPending] = useActionState(einrichtungZuruecksetzen, initialState);

  return (
    <>
      <form action={formAction}>
        {state.error && <p className="form-message error">{state.error}</p>}
        {state.success && (
          <p className="form-message success">
            Gespeichert. Tage vor dem Startdatum zählen ab sofort nicht mehr mit.
          </p>
        )}
        <label>
          Startdatum (ab wann das Tool für dich zählt)
          <input type="date" name="startdatum" defaultValue={defaultDatum} required />
        </label>
        <label>
          Aktueller Überstunden-Saldo (in Stunden, z.B. 0 oder -5.5)
          <input type="number" step="0.1" name="stundenSaldo" defaultValue={defaultStundenSaldo} required />
        </label>
        <label>
          Wie viele Ferientage hast du JETZT insgesamt noch? (dein aktueller Gesamtsaldo)
          <input type="number" step="0.1" name="aktuellerSaldo" defaultValue={defaultFerienGuthaben} required />
        </label>
        <p className="form-message small">
          Nicht der Übertrag aus dem Vorjahr, sondern dein Saldo genau jetzt in diesem Moment —
          bereits bezogene Tage dieses Jahr und dein anteiliger Jahresanspruch rechnet das Tool
          selbst dazu.
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
          Vollzeit). Bei Lernenden oder unter 20 Jahren gilt gesetzlich oft ein höherer Anspruch,
          in dem Fall hier die tatsächliche Anzahl eintragen.
        </p>
        <label>
          Zusätzlich verbrauchte Ferientage, nicht im Kalender erfasst
          <input
            type="number"
            step="0.1"
            name="ferienBezogenKorrektur"
            defaultValue={defaultFerienBezogenKorrektur}
          />
        </label>
        <p className="form-message small">
          Für Ferientage, die du schon genommen, aber nie im Kalender als Ferien-Tag eingetragen
          hast. Wird zu den echten Kalender-Einträgen dazugezählt, ersetzt sie nicht, künftige
          Einträge zählen also weiterhin normal dazu.
        </p>
        <button type="submit" disabled={pending}>
          {pending ? "Speichert…" : "Speichern"}
        </button>
      </form>

      {istEingerichtet && (
        <form action={resetAction} style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
          <p className="form-message small">
            Hast du schon echte, lückenlose Tageseinträge (z.B. weil dein Team von einem alten
            Excel übernommen hat) und die Einrichtung war ein Versehen? Dann hier zurücksetzen —
            danach zählen wieder alle erfassten Tage normal, ohne künstliche Nullung davor.
          </p>
          {resetState.error && <p className="form-message error">{resetState.error}</p>}
          {resetState.success && (
            <p className="form-message success">Zurückgesetzt. Lade die Monatsansicht neu, um den korrigierten Stand zu sehen.</p>
          )}
          <button type="submit" className="link-btn-inline" disabled={resetPending}>
            {resetPending ? "Setzt zurück…" : "Einrichtung zurücksetzen"}
          </button>
        </form>
      )}
    </>
  );
}
