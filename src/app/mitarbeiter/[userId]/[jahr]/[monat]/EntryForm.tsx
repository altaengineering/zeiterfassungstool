"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { tageseintragSpeichern } from "./actions";

export interface BestehenderEintrag {
  krank: number;
  reisezeit: number;
  ferien: number;
  cad: number;
  ausbildung: number;
  buero: number;
  spesenFr: number;
  km: number;
  sollOverride: number | null;
  start1: number | null;
  stop1: number | null;
  start2: number | null;
  stop2: number | null;
  start3: number | null;
  stop3: number | null;
  start4: number | null;
  stop4: number | null;
  projekt1Label: string;
  projekt1Stunden: number | null;
  projekt2Label: string;
  projekt2Stunden: number | null;
}

function zeitZuMinuten(wert: string | undefined): number | null {
  if (!wert) return null;
  const [h, m] = wert.split(":").map(Number);
  if (h === undefined || m === undefined || Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function minutenZuZeit(min: number | null | undefined): string {
  if (min === null || min === undefined) return "";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function rund2(n: number): number {
  return Math.round(n * 100) / 100;
}

function ferienModusVon(ferien: number, soll: number): "keine" | "halbtags" | "ganztags" {
  if (ferien <= 0) return "keine";
  if (soll > 0 && Math.abs(ferien - soll / 2) < 0.05) return "halbtags";
  return "ganztags";
}

export function EntryForm({
  userId,
  jahr,
  monat,
  datum,
  sollFuerTag,
  bestehenderEintrag,
}: {
  userId: string;
  jahr: number;
  monat: number;
  datum: string;
  sollFuerTag: number;
  bestehenderEintrag: BestehenderEintrag | null;
}) {
  const router = useRouter();

  const [gespeichert, setGespeichert] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const [weitereZeitbloecke, setWeitereZeitbloecke] = useState(
    !!(bestehenderEintrag?.start3 != null || bestehenderEintrag?.start4 != null),
  );

  const [krankChecked, setKrankChecked] = useState((bestehenderEintrag?.krank ?? 0) > 0);
  const [ferienModus, setFerienModus] = useState(
    ferienModusVon(bestehenderEintrag?.ferien ?? 0, sollFuerTag),
  );

  const [projekt1Stunden, setProjekt1Stunden] = useState(
    bestehenderEintrag?.projekt1Stunden != null ? String(bestehenderEintrag.projekt1Stunden) : "",
  );
  const [projekt2Stunden, setProjekt2Stunden] = useState(
    bestehenderEintrag?.projekt2Stunden != null ? String(bestehenderEintrag.projekt2Stunden) : "",
  );

  const start1Ref = useRef<HTMLInputElement>(null);
  const stop1Ref = useRef<HTMLInputElement>(null);
  const start2Ref = useRef<HTMLInputElement>(null);
  const stop2Ref = useRef<HTMLInputElement>(null);
  const start3Ref = useRef<HTMLInputElement>(null);
  const stop3Ref = useRef<HTMLInputElement>(null);
  const start4Ref = useRef<HTMLInputElement>(null);
  const stop4Ref = useRef<HTMLInputElement>(null);
  const projekt2LabelRef = useRef<HTMLInputElement>(null);

  function stundenAusStempelzeitenNeuBerechnen() {
    const paare = [
      [start1Ref, stop1Ref],
      [start2Ref, stop2Ref],
      [start3Ref, stop3Ref],
      [start4Ref, stop4Ref],
    ] as const;
    let totalMinuten = 0;
    for (const [start, stop] of paare) {
      const startMin = zeitZuMinuten(start.current?.value);
      const stopMin = zeitZuMinuten(stop.current?.value);
      if (startMin !== null && stopMin !== null && stopMin > startMin) {
        totalMinuten += stopMin - startMin;
      }
    }
    const totalStunden = rund2(totalMinuten / 60);
    const zweitesProjektBefuellt = (projekt2LabelRef.current?.value ?? "").trim() !== "";

    if (zweitesProjektBefuellt) {
      const haelfte = rund2(totalStunden / 2);
      setProjekt1Stunden(haelfte > 0 ? String(haelfte) : "");
      setProjekt2Stunden(haelfte > 0 ? String(haelfte) : "");
    } else {
      setProjekt1Stunden(totalStunden > 0 ? String(totalStunden) : "");
      setProjekt2Stunden("0");
    }
  }

  const monatStr = String(monat).padStart(2, "0");
  const monatMinDatum = `${jahr}-${monatStr}-01`;
  const letzterTag = new Date(Date.UTC(jahr, monat, 0)).getUTCDate();
  const monatMaxDatum = `${jahr}-${monatStr}-${String(letzterTag).padStart(2, "0")}`;

  function aufDatumWechseln(neuesDatum: string) {
    if (!neuesDatum) return;
    const [j, m] = neuesDatum.split("-").map(Number);
    if (!j || !m) return;
    router.push(`/mitarbeiter/${userId}/${j}/${m}?tag=${neuesDatum}`);
  }

  const krankHiddenWert = krankChecked ? rund2(sollFuerTag) : 0;
  const ferienHiddenWert =
    ferienModus === "ganztags" ? rund2(sollFuerTag) : ferienModus === "halbtags" ? rund2(sollFuerTag / 2) : 0;

  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="entry-form-card">
      <form
        ref={formRef}
        onSubmit={async (e) => {
          // Bewusst kein <form action={...}> (React-Formular-Action): React setzt danach
          // automatisch alle Felder zurück (auch kontrollierte Checkbox/Radio-Zustände wie
          // Krank/Ferien) — das würde die gerade gespeicherten Werte optisch wieder verwerfen,
          // obwohl sie korrekt in der DB stehen. Mit eigenem onSubmit bleibt der Formularinhalt
          // nach dem Speichern sichtbar, passend zum neuen Bearbeiten-Verhalten.
          e.preventDefault();
          setFehler(null);
          const formData = new FormData(e.currentTarget);
          try {
            await tageseintragSpeichern(formData);
            setGespeichert(true);
            setTimeout(() => setGespeichert(false), 2500);
          } catch (err) {
            setFehler(err instanceof Error ? err.message : "Speichern fehlgeschlagen.");
          }
        }}
      >
        <input type="hidden" name="userId" value={userId} />
        <input type="hidden" name="jahr" value={jahr} />
        <input type="hidden" name="monat" value={monat} />

        <div className="datum-bar">
          <label>
            Datum
            <input
              type="date"
              name="datum"
              defaultValue={datum}
              min={monatMinDatum}
              max={monatMaxDatum}
              onChange={(e) => aufDatumWechseln(e.target.value)}
              required
            />
          </label>
          <span className="edit-badge">
            {bestehenderEintrag ? "✏️ bestehender Eintrag wird bearbeitet" : "neuer Eintrag"}
          </span>
          <span className="override-hint">
            Soll-Override nur bei Sonderfällen nötig (unten, normalerweise leer lassen)
          </span>
        </div>

        <div className="entry-form">
          <div className="form-section">
            <div className="form-section-title">Stempelzeiten</div>
            <p className="form-hint">
              Beim Eintragen wird die Stundenzahl automatisch bei „Projekte“ übernommen — bei zwei
              benannten Projekten hälftig aufgeteilt.
            </p>
            <div className="zeitbloecke-grid">
              <div className="zeit-paar">
                <label>
                  Start 1
                  <input
                    type="time"
                    name="start1"
                    ref={start1Ref}
                    defaultValue={minutenZuZeit(bestehenderEintrag?.start1)}
                    onChange={stundenAusStempelzeitenNeuBerechnen}
                  />
                </label>
                <label>
                  Stop 1
                  <input
                    type="time"
                    name="stop1"
                    ref={stop1Ref}
                    defaultValue={minutenZuZeit(bestehenderEintrag?.stop1)}
                    onChange={stundenAusStempelzeitenNeuBerechnen}
                  />
                </label>
              </div>
              <div className="zeit-paar">
                <label>
                  Start 2
                  <input
                    type="time"
                    name="start2"
                    ref={start2Ref}
                    defaultValue={minutenZuZeit(bestehenderEintrag?.start2)}
                    onChange={stundenAusStempelzeitenNeuBerechnen}
                  />
                </label>
                <label>
                  Stop 2
                  <input
                    type="time"
                    name="stop2"
                    ref={stop2Ref}
                    defaultValue={minutenZuZeit(bestehenderEintrag?.stop2)}
                    onChange={stundenAusStempelzeitenNeuBerechnen}
                  />
                </label>
              </div>
              {weitereZeitbloecke && (
                <>
                  <div className="zeit-paar">
                    <label>
                      Start 3
                      <input
                        type="time"
                        name="start3"
                        ref={start3Ref}
                        defaultValue={minutenZuZeit(bestehenderEintrag?.start3)}
                        onChange={stundenAusStempelzeitenNeuBerechnen}
                      />
                    </label>
                    <label>
                      Stop 3
                      <input
                        type="time"
                        name="stop3"
                        ref={stop3Ref}
                        defaultValue={minutenZuZeit(bestehenderEintrag?.stop3)}
                        onChange={stundenAusStempelzeitenNeuBerechnen}
                      />
                    </label>
                  </div>
                  <div className="zeit-paar">
                    <label>
                      Start 4
                      <input
                        type="time"
                        name="start4"
                        ref={start4Ref}
                        defaultValue={minutenZuZeit(bestehenderEintrag?.start4)}
                        onChange={stundenAusStempelzeitenNeuBerechnen}
                      />
                    </label>
                    <label>
                      Stop 4
                      <input
                        type="time"
                        name="stop4"
                        ref={stop4Ref}
                        defaultValue={minutenZuZeit(bestehenderEintrag?.stop4)}
                        onChange={stundenAusStempelzeitenNeuBerechnen}
                      />
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
            <div className="form-section-title">Projekte</div>
            <div className="form-row-pair">
              <label>
                Projekt 1 – Name
                <input
                  type="text"
                  name="projektLabel1"
                  placeholder="z.B. Raytech AG"
                  defaultValue={bestehenderEintrag?.projekt1Label ?? ""}
                />
              </label>
              <label>
                Stunden
                <input
                  type="number"
                  step="any"
                  name="projektStunden1"
                  value={projekt1Stunden}
                  onChange={(e) => setProjekt1Stunden(e.target.value)}
                />
              </label>
            </div>
            <div className="form-row-pair">
              <label>
                Projekt 2 – Name
                <input
                  type="text"
                  name="projektLabel2"
                  placeholder="optional"
                  ref={projekt2LabelRef}
                  defaultValue={bestehenderEintrag?.projekt2Label ?? ""}
                  onChange={stundenAusStempelzeitenNeuBerechnen}
                />
              </label>
              <label>
                Stunden
                <input
                  type="number"
                  step="any"
                  name="projektStunden2"
                  value={projekt2Stunden}
                  onChange={(e) => setProjekt2Stunden(e.target.value)}
                />
              </label>
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-title">Kategorien</div>
            <div className="kategorien-row">
              <div className="toggle-field">
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={krankChecked}
                    onChange={(e) => setKrankChecked(e.target.checked)}
                  />
                  <span className="track" />
                  <span className="thumb" />
                </label>
                <span>Krank (ganzer Tag)</span>
              </div>

              <label className="reisezeit-feld">
                Reisezeit (h)
                <input
                  type="number"
                  step="0.25"
                  name="reisezeit"
                  defaultValue={bestehenderEintrag?.reisezeit ?? 0}
                />
              </label>
            </div>

            <div className="ferien-feld">
              <span className="form-section-title" style={{ marginBottom: 0 }}>
                Ferien
              </span>
              <div className="pill-group">
                <input
                  type="radio"
                  id="ferien-keine"
                  name="ferien-modus"
                  checked={ferienModus === "keine"}
                  onChange={() => setFerienModus("keine")}
                />
                <label htmlFor="ferien-keine">keine</label>

                <input
                  type="radio"
                  id="ferien-halbtags"
                  name="ferien-modus"
                  checked={ferienModus === "halbtags"}
                  onChange={() => setFerienModus("halbtags")}
                />
                <label htmlFor="ferien-halbtags">halbtags</label>

                <input
                  type="radio"
                  id="ferien-ganztags"
                  name="ferien-modus"
                  checked={ferienModus === "ganztags"}
                  onChange={() => setFerienModus("ganztags")}
                />
                <label htmlFor="ferien-ganztags">ganztags</label>
              </div>
            </div>

            <input type="hidden" name="krank" value={krankHiddenWert} readOnly />
            <input type="hidden" name="ferien" value={ferienHiddenWert} readOnly />
          </div>

          <div className="form-section">
            <div className="form-section-title">Spesen &amp; Sonstiges</div>
            <div className="form-grid">
              <label>
                Spesen (Fr.)
                <input type="number" step="0.05" name="spesenFr" defaultValue={bestehenderEintrag?.spesenFr ?? 0} />
              </label>
              <label>
                Km
                <input type="number" step="1" name="km" defaultValue={bestehenderEintrag?.km ?? 0} />
              </label>
              <label>
                Soll-Override (h)
                <input
                  type="number"
                  step="0.1"
                  name="sollOverride"
                  placeholder="leer = automatisch"
                  defaultValue={bestehenderEintrag?.sollOverride ?? undefined}
                />
              </label>
            </div>
            <div className="form-hint" style={{ marginTop: 4 }}>
              Sonstiges
            </div>
            <div className="form-grid">
              <label>
                CAD (h)
                <input type="number" step="0.25" name="cad" defaultValue={bestehenderEintrag?.cad ?? 0} />
              </label>
              <label>
                Ausbildung (h)
                <input type="number" step="0.25" name="ausbildung" defaultValue={bestehenderEintrag?.ausbildung ?? 0} />
              </label>
              <label>
                Büro (h)
                <input type="number" step="0.25" name="buero" defaultValue={bestehenderEintrag?.buero ?? 0} />
              </label>
            </div>
          </div>

          <div className="entry-form-footer">
            <button type="submit">Tag speichern</button>
            {gespeichert && <p className="form-message success">Gespeichert.</p>}
            {fehler && <p className="form-message error">{fehler}</p>}
          </div>
        </div>
      </form>
    </div>
  );
}
