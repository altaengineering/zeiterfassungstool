"use client";

import { useRef } from "react";
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

  return (
    <form
      className="entry-form"
      ref={formRef}
      action={async (formData) => {
        await tageseintragSpeichern(formData);
        formRef.current?.reset();
      }}
    >
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="jahr" value={jahr} />
      <input type="hidden" name="monat" value={monat} />

      <label className="full">
        Datum
        <input type="date" name="datum" defaultValue={defaultDatum} required />
      </label>

      <label>
        Projekt 1 – Name
        <input type="text" name="projektLabel1" placeholder="z.B. Raytech AG" />
      </label>
      <label>
        Projekt 1 – Stunden
        <input type="number" step="0.25" name="projektStunden1" />
      </label>
      <label>
        Projekt 2 – Name
        <input type="text" name="projektLabel2" placeholder="optional" />
      </label>
      <label>
        Projekt 2 – Stunden
        <input type="number" step="0.25" name="projektStunden2" />
      </label>

      <label>
        krank
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

      <label>
        Start 1
        <input type="time" name="start1" />
      </label>
      <label>
        Stop 1
        <input type="time" name="stop1" />
      </label>
      <label>
        Start 2
        <input type="time" name="start2" />
      </label>
      <label>
        Stop 2
        <input type="time" name="stop2" />
      </label>
      <label>
        Start 3
        <input type="time" name="start3" />
      </label>
      <label>
        Stop 3
        <input type="time" name="stop3" />
      </label>
      <label>
        Start 4
        <input type="time" name="start4" />
      </label>
      <label>
        Stop 4
        <input type="time" name="stop4" />
      </label>

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

      <button type="submit">Tag speichern</button>
    </form>
  );
}
