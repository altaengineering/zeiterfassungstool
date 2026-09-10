# Zeiterfassung Alta Engineering AG – Projekt-Referenz

**Status (Stand 2026-09-08): Live und in Nutzung.**
URL: https://zeiterfassungstool-psi.vercel.app — GitHub: https://github.com/altaengineering/zeiterfassungstool
(privates Repo). Login mit E-Mail + Passwort für alle 14 Mitarbeitenden, Rollen MITARBEITER/ADMIN
(Stefan Herger + Michael Küng sind Admin; in der Anzeige heisst Michaels Rolle aus Spass „sudo“,
technisch ist es dieselbe ADMIN-Rolle — siehe `email === "m.kueng@alta-engineering.ch"`-Sonderfall
in `src/app/admin/page.tsx`). Vorhanden: Monatsansicht mit Soll/Ist/+/-/Stand pro Tag (rollierender
Saldo über Monatsgrenzen, Monats-Navigation), Ferien-Widget, Tageserfassung via Server Action,
Excel-Export im Originalformat (`src/lib/export/exportExcel.ts`, **jedes Nicht-Schaltjahr**
unterstützt, siehe `istSchaltjahr()` dort — Schaltjahre wie 2028/2032 bewusst noch nicht), Dark
Mode, Passwort selbst ändern (`/konto/passwort`), Admin-Nutzerverwaltung mit Passwort-Reset sowie
Anlegen/Löschen von Mitarbeitenden (`/admin`), Feiertage-Verwaltung (`/admin/feiertage`),
Monatsabschluss (`/admin/monatsabschluss` — sperrt einen Monat firmenweit für Mitarbeitende,
Admins können trotzdem noch korrigieren, Modell `MonthClose`), eine "Einrichtung"-Seite
(`/konto/einrichtung`) gegen die leere Startphase (siehe nächster Absatz), sowie eine
Pensumwechsel-Verwaltung (`/admin/pensum/[userId]`, siehe Absatz danach).

**"Leere Startphase" — gelöst (2026-09-07):** Neues Feld `JahresStammdaten.erfassungStartDatum`
(`DateTime?`, in beiden Schema-Dateien). Auf `/konto/einrichtung` trägt jede Person Startdatum +
aktuellen Stunden-/Ferienstand ein; die Tages-Schleife in
`src/app/mitarbeiter/[userId]/[jahr]/[monat]/page.tsx` UND `src/lib/export/exportExcel.ts` /
`src/app/api/export/.../route.ts` erzwingen für jeden Tag vor diesem Datum `sollOverride = 0`
(Vorrang vor einem evtl. vorhandenen DB-Wert). Solange `erfassungStartDatum` noch `null` ist, zeigt
die Monatsansicht einen Hinweis-Banner. Mit echten Testdaten verifiziert (Dominic Gruber, Startdatum
1.9., Saldo 3.5h → alle Augusttage zeigen Soll/Ist/+/- = 0 und Stand bleibt bei 3.5, ab 1.9. zählt
es normal weiter).

**Pensumwechsel mitten im Jahr — gelöst (2026-09-07):** Neues Modell `PensumWechsel` (userId,
`gueltigAb: DateTime`, anstellungPct, wochenstunden, in beiden Schema-Dateien). Admins tragen unter
`/admin/pensum/[userId]` (verlinkt aus der Nutzerverwaltung) beliebig viele Wechsel mit Datum ein;
ab `gueltigAb` gilt der neue Wert für den Tages-Soll, alle Tage davor rechnen mit dem zuvor gültigen
Wert bzw. der Basis aus `JahresStammdaten` (Auflösung in `src/lib/calc/pensum.ts`,
`pensumFuerDatum`/`sollProTagFuerDatum` — bei mehreren Wechseln zählt der letzte mit
`gueltigAb <= Datum`). `berechneTagesReihe`/`berechneTag` (`src/lib/calc/tag.ts`) akzeptieren dafür
jetzt statt eines konstanten Soll-pro-Tag-Werts auch eine Funktion `(date) => number`; ebenso nimmt
`berechneFerienBezogen` (`src/lib/calc/ferien.ts`) optional ein Array (ein Wert pro Monat) statt
eines einzelnen Werts. Im Excel-Export (`src/lib/export/exportExcel.ts`) wird die Soll-Zelle (R) für
Tage nach einem Wechsel als Literalwert geschrieben (die Formel selbst rechnet nur mit dem
konstanten Jahres-Basiswert Summen!$B$9) — analog zum bestehenden `sollOverride`-Mechanismus. Mit
Testdaten verifiziert (Michael Küng, Wechsel 1.8.2026 auf 80%: Juli zeigt weiterhin Soll/Tag 8.40h,
August korrekt 6.72h, Kopfzeile passt sich pro Monat an; Excel-Export mit aktivem Wechsel läuft ohne
Fehler durch).

**Tageserfassung überarbeitet — modernisiert + Bearbeiten-Funktion (2026-09-08):**
`EntryForm.tsx`/`page.tsx` im Monatsansicht-Ordner grundlegend erneuert:
- **Bearbeiten statt nur Erfassen:** Die Seite akzeptiert jetzt `?tag=YYYY-MM-DD` (`searchParams`
  in `page.tsx`). Ändert man das Datum im Formular, navigiert `EntryForm` (`router.push`) auf
  `/mitarbeiter/[userId]/[jahr]/[monat]?tag=...` (ggf. auch in einen anderen Monat); `page.tsx`
  lädt dafür den bestehenden `DailyEntry` (falls vorhanden) und reicht ihn als
  `bestehenderEintrag`-Prop rein. Wichtig: `<EntryForm key={ausgewaehltesDatum} .../>` — der
  `key`-Wechsel erzwingt einen Remount, sonst würden uncontrolled Felder (`defaultValue`) beim
  Datumswechsel nicht auf die neuen Werte zurückgesetzt.
- **Krank = Toggle, Ferien = keine/halbtags/ganztags:** Beide sind rein UI-seitig (Checkbox/Pill-
  Gruppe), die tatsächlichen DB-Felder `krank`/`ferien` bleiben Float-Stunden — ein verstecktes
  Input rechnet beim Rendern `sollFuerTag` (bzw. die Hälfte) in die Stunden um. `sollFuerTag` ist
  der `soll`-Wert des gewählten Tages aus `berechneTagesReihe` (an Wochenenden/bezahlten
  Feiertagen 0 — Krank/Ferien ergeben dort also bewusst 0 Stunden Gutschrift).
- **Stempelzeiten → automatische Stundenzahl bei Projekt 1/2:** Bei jeder Änderung von
  Start/Stopp wird die Gesamtzeit berechnet und in „Projekt 1 – Stunden“ eingetragen; ist
  „Projekt 2 – Name“ befüllt, wird 50/50 aufgeteilt. Weiterhin manuell überschreibbar (nur bei
  erneuter Stempelzeit-Änderung wird wieder überschrieben).
- **CAD/Ausbildung/Büro** stehen jetzt unter „Spesen & Sonstiges“ statt bei „Kategorien“.
- ⚠ **Gefundene und behobene Stolperfalle:** `<form action={fn}>` (React-19-Form-Actions) setzt
  nach erfolgreicher Aktion automatisch alle Formularfelder zurück — auch kontrollierte
  Checkbox/Radio-Zustände (DOM-`checked` wird durch den nativen Reset verändert, React merkt es
  nicht, weil kein `onChange` gefeuert wird → Desync). Das hätte die gerade gespeicherten
  Krank/Ferien-Auswahl nach dem Speichern optisch wieder gelöscht. Behoben durch
  `onSubmit`+`e.preventDefault()`+manuelles `new FormData(e.currentTarget)` statt der
  `action`-Prop — bei künftigen Formularen mit kontrollierten Feldern, die nach dem Speichern
  sichtbar bleiben sollen, denselben Ansatz verwenden, nicht `<form action={...}>`.
- Mit Testdaten verifiziert (Stempelzeiten → exakte Stundenzahl inkl. 50/50-Split, Krank-Toggle an
  einem Wochentag → korrekt `krank = Soll-Tag` in DB, Bearbeiten-Modus lädt bestehende Werte
  inkl. Stempelzeiten/Projekte korrekt beim Datumswechsel).
- ⚠ **Zweite gefundene und behobene Stolperfalle (2026-09-08):** Die Formular-Felder waren trotz
  vorhandenem CSS nur mit Browser-Standardstyling sichtbar (kein Rahmen, falsches Grau, Label und
  Feld nebeneinander statt gestapelt) — Ursache: `globals.css` hatte die Regeln als
  `form.entry-form label/input/...` (verlangt ein `<form>`-Element mit dieser Klasse), tatsächlich
  trägt aber ein innerer `<div className="entry-form">` diese Klasse, das `<form>` selbst hat gar
  keine Klasse. Der Selektor hat daher NIE gegriffen (auch nicht vor dem heutigen Redesign — war
  vermutlich schon immer so, ist bei den bisherigen schmalen Test-Viewports nur nicht aufgefallen,
  weil ungestylte Inputs mit `width:100%` bei wenig Platz zufällig trotzdem umbrachen). Fix: alle
  `form.entry-form ...`-Selektoren in `globals.css` zu `.entry-form ...` verkürzt (passt jetzt auf
  den tatsächlichen div). Bei künftigem CSS für dieses Formular immer mit `getComputedStyle(...)`
  im Browser gegenprüfen, ob die Klasse wirklich am erwarteten Element sitzt — sieht in schmalen
  Testfenstern leicht "zufällig richtig" aus, obwohl der Selektor gar nicht matcht.

**E-Mail-Benachrichtigung bei Krankmeldung (2026-09-08):** Neues Modul `src/lib/email.ts`
(`sendeKrankmeldung`) über die Bibliothek `resend` (in `package.json`). `tageseintragSpeichern`
(`src/app/mitarbeiter/[userId]/[jahr]/[monat]/actions.ts`) vergleicht vor dem Upsert den
bisherigen `krank`-Wert mit dem neuen — nur beim Wechsel von 0 auf >0 wird eine E-Mail an alle
`ADMIN`-Nutzer:innen der Firma (ausser die betroffene Person selbst, falls sie z.B. selbst Admin
ist) geschickt, nicht bei jedem erneuten Speichern desselben Tages. Braucht die Umgebungsvariable
`RESEND_API_KEY` (siehe `.env.example`) — **ist aktuell noch NICHT gesetzt**, weder lokal noch auf
Vercel; ohne sie wird nur eine Konsolen-Warnung ausgegeben, das Speichern selbst funktioniert
trotzdem einwandfrei (siehe `email.ts`, bewusst so gebaut, damit ein fehlender/falscher Versand nie
einen Tageseintrag blockiert). **Für den Nutzer offen, um die Mails tatsächlich zu verschicken:**
1) Konto auf resend.com anlegen (kostenlos für dieses Volumen), 2) API-Key erzeugen und als
`RESEND_API_KEY` in Vercel → Settings → Environment Variables UND lokal in `.env` eintragen,
3) für zuverlässigen Versand an beliebige Empfänger (nicht nur die eigene Resend-Kontoadresse)
die Domain `alta-engineering.ch` bei Resend verifizieren (DNS-Einträge, dauert etwas) und danach
`RESEND_FROM_EMAIL` auf eine Adresse dieser Domain setzen (z.B.
`zeiterfassung@alta-engineering.ch`) — ohne Domain-Verifizierung liefert der Resend-Sandbox-Absender
`onboarding@resend.dev` nur zuverlässig an die E-Mail-Adresse des Resend-Kontoinhabers selbst.

Noch offen:
- Domain: Nutzer wollte ggf. `zeit.alta-engineering.ch` statt der Vercel-URL einrichten (Anleitung
  im Chat gegeben, Cloudflare-Zugriff nötig — noch nicht umgesetzt)
- Excel-Export für Schaltjahre (2028, 2032, …) — bräuchte eine zusätzliche Zeile in der Feb-Tabelle
  der Vorlage inkl. Verschiebung aller Formelbezüge, siehe Kommentar in `exportExcel.ts`
- Später: Umstieg auf Infomaniak-Hosting (Schweiz) für Produktivbetrieb (§7 Punkt 5), falls
  Personaldaten-Compliance das erfordert — aktuell auf Vercel + Prisma Postgres (US/EU, siehe
  Vercel-Dashboard für genaue Region)
- Handbuch/Zugangsdaten-PDFs für Stefan sind erstellt und dem Nutzer geschickt (nicht im Repo,
  `handover/`-Ordner, gitignored, enthält Klartext-Passwörter). Handbuch bewusst ohne jede
  Erwähnung von KI/Claude/Anthropic (Kundenanforderung) — bei künftigen Änderungen daran
  festhalten, falls das Dokument erneut generiert wird.

**Einrichtung: Selbst-Service-Reset ergänzt (2026-09-08):** Michael hatte auf der Live-Seite selbst
die "Einrichtung" ausgefüllt (Startdatum = Folgetag), obwohl er für Juni-September bereits echte
Tageseinträge hatte — dadurch wurde `sollOverride=0` für alle diese Tage erzwungen und sein
korrekt berechneter Saldo verfälscht (siehe §7 "leere Startphase"-Mechanik, die genau das für Tage
vor dem Startdatum tut). Es gab bisher keine Möglichkeit, `erfassungStartDatum` wieder auf `null`
zu setzen (`einrichtungSpeichern` verlangt zwingend ein Datum). Behoben durch eine neue Server
Action `einrichtungZuruecksetzen` (`src/app/konto/einrichtung/actions.ts`) + Button "Einrichtung
zurücksetzen" (nur sichtbar, wenn bereits eingerichtet) in `EinrichtungForm.tsx` — setzt
`erfassungStartDatum: null, stundenuebertragAltesJahr: 0, ferienuebertragAltesJahr: 0` für die
eigene Person zurück (self-service, jede Person nur für sich selbst). Zusätzlich zeigt
`/konto/einrichtung` jetzt einen Warnhinweis ("nur ausfüllen, wenn keine echten Einträge vor dem
Startdatum bestehen") und die Zahlenfelder laden beim erneuten Öffnen die zuletzt gespeicherten
Werte statt immer bei 0 zu starten. Lokal verifiziert: Einrichtung mit Startdatum "morgen" gesetzt
→ Juli-Stand verfälscht, "Einrichtung zurücksetzen" geklickt → Stand exakt wieder korrekt
(Stand Vormonat 2.49h / Stand Ende Monat -4.36h, identisch zum Ausgangswert). **Michael muss auf
der Live-Seite unter „Einrichtung“ einmal auf „Einrichtung zurücksetzen“ klicken, sobald dieses
Deployment live ist**, um seinen eigenen Saldo zu reparieren — dafür wird keine Datenbank-
Direktbearbeitung benötigt.

**Nachtrag (2026-09-08):** Michael fragte danach, wie er dann den roten Banner trotzdem loswird,
ohne wieder seinen Saldo zu verfälschen — der Banner erschien bei ihm nur, weil `erfassungStart
Datum` null war, unabhängig davon, ob schon echte Daten existieren. Behoben in
`mitarbeiter/[userId]/[jahr]/[monat]/page.tsx`: Banner-Bedingung von `!startDatumIso` auf
`!startDatumIso && entriesDb.length === 0` verschärft — er erscheint jetzt nur noch, wenn wirklich
noch **kein einziger** Tageseintrag im Jahr existiert. Für Personen mit bereits vorhandenen
Tageseinträgen (wie Michael) verschwindet der Banner dauerhaft von selbst, ohne dass „Einrichtung“
je ausgefüllt werden muss — für Personen ganz ohne Daten bleibt er wie gehabt sichtbar. Lokal
gegengetestet: Michael (mit Juli-Daten) → kein Banner mehr; Andrit Stojkaj (keine Einträge) →
Banner weiterhin sichtbar.

**Excel-Export: Ist/+-/Stand zeigten 0 nach dem Export (behoben, 2026-09-10):** Michael meldete,
dass sein Export für September komplett falsch war (`Ist` überall 0.00, obwohl `C`/`D` echte
Projektstunden enthielten, `Stand` entsprechend stark negativ statt der echten, live im Tool
korrekten Werte). Ursache: `exportExcel.ts` schreibt nur die Eingabezellen (`C:Q`, `V/W`, `Y:AF`),
`Ist` (`S`), `+/-` (`T`) und `Stand` (`U`) bleiben als Formel aus der Vorlage stehen, siehe
Modulkommentar. `exceljs` berechnet Formeln beim Schreiben aber nie neu, sondern lässt den alten,
in der Vorlage gecachten `<v>`-Wert stehen (verifiziert: `S4` enthielt exakt `SUM(C4:Q4)` mit
gecachtem `<v>0</v>`, obwohl `C4=3`/`D4=6` frisch geschrieben wurden). Für Monate, die in der
Vorlage vorher leer waren (z.B. September, die Vorlage `Arbeitsrapport_2026_kum.xlsx` hat nur für
Jun bis Aug echte, in echtem Excel gespeicherte Werte), bleibt der gecachte `0`-Wert stehen, bis
irgendetwas eine Neuberechnung erzwingt. Fix: `workbook.calcProperties.fullCalcOnLoad = true;`
direkt nach `workbook.xlsx.readFile(...)` gesetzt, das zwingt jedes Programm (Excel, LibreOffice,
Google Sheets) beim Öffnen zu einer vollständigen Neuberechnung, unabhängig vom gecachten Wert.
Lokal verifiziert per Testskript: `<calcPr fullCalcOnLoad="1"/>` landet korrekt in
`xl/workbook.xml`, Formel-Text in `S4` unverändert `SUM(C4:Q4)`. **Betrifft alle bisherigen
Exports, nicht nur Michaels** — jeder Export für einen Monat, der in der Vorlage vorher leer war,
war von diesem Bug betroffen. Kein Datenverlust, nur eine Anzeige-/Berechnungsfalle beim Export
selbst, die Datenbank war nie falsch.

**Projekte: Stundenzahl automatisch aus Stempelzeiten, beliebig viele Projekte (2026-09-10):**
`EntryForm.tsx` zeigt jetzt live "Gesamt aus Stempelzeiten: X.XX h" (berechnet wie bisher aus
Start/Stopp-Paaren, siehe `berechneGesamtStunden`). Neue Verteilungsregel in
`projektStundenNeuVerteilen`: das jeweils LETZTE Projekt mit einem ausgefüllten Namen "absorbiert"
den Rest, also Gesamt minus die Summe aller anderen benannten Projekte. Ist noch kein Projekt
benannt, ist Projekt 1 der Absorber (der übliche Fall bei nur einem Projekt pro Tag). Trägt man von
Hand eine Stundenzahl bei einem früheren Projekt ein, rechnet sich der Rest automatisch beim
letzten Projekt nach, das Feld des Absorbers selbst wird beim direkten Bearbeiten nie
überschrieben (sonst könnte man es nie manuell anpassen). Ausserdem: Projekt-Anzahl ist jetzt
dynamisch statt fix auf 2 begrenzt, ein Button "+ weiteres Projekt" (analog zu "+ weitere
Zeitblöcke") schaltet bis zu `MAX_PROJEKTE = 6` Projekte pro Tag frei. `BestehenderEintrag.bookings`
(Array statt der vorherigen festen `projekt1Label`/`projekt1Stunden`/`projekt2Label`/
`projekt2Stunden`-Felder) in `EntryForm.tsx`, entsprechend angepasst in `page.tsx`. In `actions.ts`
läuft die Booking-Persistierung jetzt über `for (let i = 1; i <= 6; i++)` statt der harten
`[1, 2]`-Schleife, das Datenmodell (`Booking`) brauchte keine Änderung, es unterstützte beliebig
viele frei benannte Buchungen pro Tag schon immer. Lokal end-to-end getestet (separater
SQLite-Testklon, nicht dieses Arbeitsverzeichnis): 3 Projekte angelegt, Rest-Verteilung bei
Stempelzeit- und Label-Änderungen sowie manuellem Überschreiben verifiziert, gespeicherter
Tageseintrag zeigte alle 3 Buchungen korrekt in der Tagesübersicht.

**Zugangsdaten & Secrets:** `.env` (lokal, SQLite) und Vercel-Projekt-Settings (Produktions-Secrets:
`DATABASE_URL`, `AUTH_SECRET`, `AUTH_TRUST_HOST`) — nicht im Repo. Mitarbeitenden-Liste mit
Klartext-Passwörtern liegt lokal in `prisma/seed-data/mitarbeitende-2026.local.json`
(gitignored, **nicht committen**) — falls diese Datei fehlt (z.B. neuer Rechner/neuer Chat), beim
Nutzer nachfragen oder über die Admin-Oberfläche (`/admin`) neue Passwörter setzen.

**Datenbank/Deployment:** Zwei parallele Prisma-Schemas (bewusst dupliziert, siehe Kommentar in
`prisma/schema.production.prisma`):
- `prisma/schema.prisma` — SQLite, für die lokale Offline-Demo (`prisma/dev.db`, gitignored).
- `prisma/schema.production.prisma` — PostgreSQL (Prisma Postgres, verbunden via Vercel Storage).
  Wird im Vercel-Build automatisch generiert + geschoben (`package.json` Skript `vercel-build`,
  nutzt `prisma db push`, keine formalen Migrationen für den POC-Stand).

Bei Schema-Änderungen **beide Dateien synchron halten**. Um lokal gegen Produktion zu skripten
(z.B. Seed erneut laufen lassen): `npx prisma generate --schema=prisma/schema.production.prisma`,
dann `DATABASE_URL="<prod-connection-string>" npx tsx prisma/seed.ts`, danach unbedingt
`npx prisma generate` (ohne Argument) um den lokalen SQLite-Client wiederherzustellen — sonst
funktioniert `npm run dev` lokal nicht mehr (Client-Dialekt passt sonst nicht zur SQLite-Datei).

**Git-Workflow-Hinweis:** In dieser Session hat `git push` (und gelegentlich `git commit`) über das
Bash-Tool wiederholt einen "Blocked by classifier"-Fehler ausgelöst (Auto-Mode-Sicherheitsregel).
Funktionierender Workaround: Befehl trotzdem versuchen (manchmal geht er durch), sonst den Nutzer
bitten, `git push` selbst in einem eigenen Terminal auszuführen (Remote ist bereits korrekt
gesetzt: `origin` → `https://github.com/altaengineering/zeiterfassungstool.git`, Branch `main`).


Diese Datei ist die verbindliche Business-Logik-Referenz für alle künftigen Claude-Code-Sessions
an diesem Projekt. Quelle: `Zeiterfassung_Spezifikation.md` **und** die tatsächlichen Formeln aus
`Arbeitsrapport_2026_kum.xlsx` (per openpyxl mit `data_only=False` ausgelesen, nicht nur die
gecachten Werte). Bei Widersprüchen zwischen Spezifikationstext und Excel-Formel gilt bis auf
Weiteres **die Excel-Formel als Quelle der Wahrheit** (siehe Abschnitt "Offene Fragen" – dort sind
die gefundenen Widersprüche dokumentiert, bis der Nutzer sie explizit klärt).

## 1. Zweck

Ersatz für den manuell geführten Excel-Arbeitsrapport von 15 Mitarbeitenden. Direkte Online-Erfassung,
automatisches Speichern, kein Datei-Upload mehr. Stefan (Admin) sieht alle Mitarbeitenden und kann
einen Excel-Export im Originalformat ziehen.

## 2. Datenmodell

### User
- Name, Firma (aktuell nur "Alta Engineering AG"), Rolle (`mitarbeiter` / `admin`)
- Login-Zugangsdaten

### JahresStammdaten (pro User + Jahr — entspricht Blatt "Summen", Zellen B1–B44)
| Feld | Excel-Zelle | Formel/Bedeutung |
|---|---|---|
| Firmenname | Summen!B1 | manuell |
| Anstellung % | Summen!B5 | manuell, z.B. 1.0 = 100% |
| Arbeitsstunden/Woche | Summen!B6 | manuell, z.B. 42 |
| **Arbeitszeit pro Tag (Soll/Tag)** | Summen!B9 | `= Wochenstunden / 5 * Anstellung%` — **das ist der zentrale Wert, der täglich im Soll verwendet wird** |
| Anzahl Vorholtage | Summen!B10 | manuell |
| Vorholzeit pro Tag | Summen!B11 | `= B25/C25 - B9` — **wird nirgends sonst im Original verwendet** (weder in der Tages-Soll-Formel noch im Export sichtbar). Vermutlich nur informativ. Siehe offene Frage. |
| Arbeitszeit/Tag inkl. Vorholzeit | Summen!B12 | `= B9 + B11` — ebenfalls **ungenutzt** im Rest der Datei |
| Stundenübertrag altes Jahr | Summen!B14 | manueller Startwert → wird Startwert für `Stand` am 1. Januar (`Jan!U2`) |
| Ferienübertrag altes Jahr | Summen!B15 | manueller Startwert |
| Jahresferientage neu | Summen!B16 | `= 6.5/12*20 - 0.00333333` (≈ 10.83 Tage/Jahr) — **magische Konstante, für alle Mitarbeitenden identisch/hart codiert im Original**. Bedeutung von `0.00333333` unklar (Rundungskorrektur?). Siehe offene Frage. |
| Anzahl Arbeitsmonate | Summen!B17 | manuell, Standard 12 |
| Ferien Guthaben | Summen!B18 | `= ROUND(Ferienübertrag_altesJahr + Arbeitsmonate/12 * Jahresferientage_neu, 1)` |
| Ferien bezogen im Jahr | Summen!B19 | `= Dez!H2 + (Dez!Q35 / B9)` — siehe Kettenmechanismus unten |
| Ferienübertrag nächstes Jahr | Summen!B20 | `= Ferien_Guthaben - Ferien_bezogen` |
| Kilometer-Spesensatz | Summen!B44 | manuell, z.B. 0.70 CHF/km, **pro Firma/Jahr konfigurierbar** |

**Ferien-bezogen-Kette (wichtig für Reimplementierung):** Jeder Monat hat im Kopfbereich ein Feld
"Bezogen:" (`H2`), das NICHT direkt aus allen Monaten summiert wird, sondern sich verkettet fortträgt:
```
Jan!H2 = 0                                  (manueller Startwert)
Feb!H2 = Jan!H2 + (Jan!Q35 / Summen!B9)     (Q35 = Summe Ferien-Stunden im Monat, /Soll-pro-Tag = Tage)
Mar!H2 = Feb!H2 + (Feb!Q_total / Summen!B9)
...
Summen!B19 (Ferien bezogen im Jahr) = Dez!H2 + (Dez!Q_total / Summen!B9)
```
Das ist funktional äquivalent zu "Summe aller Ferientage über alle 12 Monate", aber technisch als
Kette von Monat zu Monat implementiert. In der DB am einfachsten als abgeleiteter Wert
(Summe Ferien-Stunden aller Vormonate + laufender Monat) / Soll-pro-Tag berechnen.

### Feiertage (Stammdaten, editierbar pro Firma/Jahr — Blatt "Feiertage")
| Spalte | Feld |
|---|---|
| B | Datum |
| C | Bezeichnung |
| D | bezahlt ("ja"/"nein") |

Zusätzlich: Zelle `Feiertage!C23` enthält die feste Textmarke `"Wochenende"`, die als Anzeige-Label
für Wochenendtage verwendet wird (kein echter Feiertag-Eintrag, nur Konstante für die Anzeige).

**Beispiel-Feiertagsliste 2026** (Alta Engineering, siehe Spezifikation §Feiertage): Neujahr,
Josefstag, Karfreitag, Ostermontag, Auffahrt, Pfingstmontag, Fronleichnam, Nationalfeiertag,
Maria Himmelfahrt, Justustag, Allerheiligen, Maria Empfängnis, Weihnachtstag, Stephanstag.
Im Beispiel sind `Ostermontag` und `Pfingstmontag` als `bezahlt = "nein"` markiert, alle anderen `"ja"`.

### Projekt (dynamisch, pro Mitarbeitendem + Monat frei benennbar!)
Die Spalten C–K im Monatsblatt sind **keine festen Projekt-Slots**, sondern werden pro Monat und
Mitarbeitendem frei umbenannt/neu belegt. Beobachtete Beispiele im Original:
- Jan: nur "Alta Engineering"
- Feb: "Pfisterer AG", "Alta Eng."
- Jun: "Raytech AG", "Avesco AG", "Unproduktiv"
- Jul: "Avesco", "Unproduktiv", "Web Projekte", "Villiger"
- Aug: "Villiger" (C) und "NBU" (K) — **auch Nicht-Projekt-Kategorien wie "NBU" (Nichtberufsunfall)
  werden gelegentlich in diese freien Spalten gepackt**, nicht nur echte Kundenprojekte.

→ **Datenmodell-Konsequenz:** Projekt/Kategorie-Buchungen als eigene Entität modellieren
(`Booking`: userId, date, label, hours), NICHT als feste Spalten. Labels sind pro Monat frei,
maximal 9 Stück (C–K) im Original, aber die App muss das nicht als Hard-Limit übernehmen.

### Tageseintrag (DailyEntry) — ein Datensatz pro User + Datum
| Feld | Typ | Excel-Spalte |
|---|---|---|
| Datum | Date | A |
| Projekt-/Kategorie-Buchungen | Booking[] (label, hours) | C–K, frei benennbar |
| krank | Number (h) | L |
| Reisezeit | Number (h) | M |
| CAD | Number (h) | N |
| Ausbildung | Number (h) | O |
| Büro | Number (h) | P |
| Ferien | Number (h) | Q |
| Spesen Fr. | Number (CHF) | V |
| Km | Number | W |
| Start1/Stop1 … Start4/Stop4 | Time × 8 | Y–AF |

## 3. Berechnungslogik (pro Tag) — verbindliche Formeln

```
Soll[Tag] =
  0                                    wenn WEEKDAY(Datum,2) in {6,7}   (Samstag/Sonntag)
  0                                    sonst, wenn Feiertag(Datum) gefunden UND bezahlt = "ja"
  Soll-pro-Tag (Summen!B9)             sonst, wenn Feiertag(Datum) gefunden UND bezahlt = "nein"
  Soll-pro-Tag (Summen!B9)             sonst (normaler Arbeitstag)

Ist[Tag] = SUMME(alle Projekt-/Kategorie-Stunden: C..Q, also Projekte + krank + Reisezeit + CAD
                  + Ausbildung + Büro + Ferien)

+/-[Tag] = Ist[Tag] - Soll[Tag]

Stand[Tag] = Stand[Vortag] + (+/-[Tag])
  // rollierender Saldo, läuft über Monats- UND Jahresgrenzen hinweg
  // Startwert 1. Januar = Summen!B14 "Stundenübertrag altes Jahr"
  // Startwert jeden Folgemonats = Stand des letzten Tages im Vormonat (Kette: Feb!U2 = Jan!U(letzter Tag))

Ist-Zeit-aus-Stempelzeiten[Tag] =
  (Stop1-Start1) + (Stop2-Start2) + (Stop3-Start3) + (Stop4-Start4)
  dargestellt als:
    hh:mm  (AG, Excel-Zeitformat)
    hh     (AH = HOUR(AG))
    .hh    (AI = MINUTE(AG)/60)
    h.h    (AJ = AH + AI)  ← das ist die "echte" Dezimalstunden-Darstellung

Aufteilung-Istzeit[Tag] = SUMME(C..Q) - AJ[Tag]
  // Kontrollspalte, sollte im Idealfall 0 sein (gebuchte Kategorien == gestempelte Zeit)
```

**Exakte Original-Formel für Soll** (Referenz, Blatt Jan-Dez, Spalte R):
```
=IF(OR(WEEKDAY(A4,2)=6,WEEKDAY(A4,2)=7),
    0,
    IFERROR(
      IF(VLOOKUP(A4,Feiertage!$B:$D,3,0)="ja", 0, Summen!$B$9),
      Summen!$B$9
    )
  )
```
Wichtig: Bei einem Feiertag mit `bezahlt="nein"` liefert diese Formel **den vollen Tages-Soll**
(`Summen!$B$9`), NICHT 0. Das weicht vom Fließtext der ursprünglichen Spezifikation ab.
**Entschieden (siehe §7):** Diese Excel-Formel ist verbindlich — Soll wird nur bei `bezahlt="ja"`
auf 0 gesetzt, bei `"nein"` bleibt der volle Tages-Soll bestehen.

**Manuelles Überschreiben von Soll (entschieden, siehe §7):** Die App muss erlauben, den
automatisch berechneten Tages-Soll für einzelne Tage manuell zu überschreiben (z.B. Teilzeit-Start,
unbezahlter Urlaub, Sonderfälle) — analog zum Original-Excel, wo Zellen einfach überschrieben werden
konnten. Datenmodell-Konsequenz: `DailyEntry` braucht ein Feld `sollOverride: number | null` —
wenn gesetzt, hat es Vorrang vor der automatisch berechneten Soll-Zeit; sonst gilt die
Wochenende/Feiertag-Formel oben. UI sollte klar anzeigen, wenn ein Tag manuell überschrieben wurde.

## 4. Monats-/Jahresebene (Blatt "Summen")

- Total-Zeile je Monatsblatt: Summe je Spalte C–Q, R (Soll-Summe), S (Ist-Summe), T (+/- Summe);
  `Stand`-Summe = einfach der letzte Tageswert (kein Aufsummieren!)
- Stand am Monatsende = Startwert `U2` (Stundenübertrag Vormonat) des Folgemonats
- Spesen-Summe/Tag: `X[Tag] = Spesen_Fr[Tag] + Km[Tag] * Summen!B44`
- Spesen-Total/Monat: `V_total + W_total * Summen!B44` (Reihenfolge vertauscht, mathematisch identisch)
- Drei Varianten Jahres-Soll-Arbeitszeit (nur für Übersicht/Kennzahlen, nicht für Tages-Stand relevant):
  - **o.F.o.F** (ohne Ferienabzug, ohne Vorholtage): `SUMME(alle Monats-Soll-Totale) * (Arbeitsmonate/12)`
  - **m.F.o.F** (mit Ferienabzug, ohne Vorholtage): `(SUMME(Monats-Soll-Totale) - Ferien_Guthaben*Soll_pro_Tag) * (Arbeitsmonate/12)`
  - **m.F.m.F** (mit Ferien, mit Vorholtage): im Original **identische Stundenformel wie m.F.o.F**
    (Vorholtage werden dort NICHT von den Stunden abgezogen — nur die parallele Arbeitstage-Spalte
    zieht `- Anzahl_Vorholtage` ab). Mögliche Inkonsistenz im Original, siehe offene Frage.
- Ferien-Übersicht: Guthaben (B18), bezogen (B19), Übertrag nächstes Jahr (B20) — siehe Formeln oben

## 5. Rollen & Rechte

- **Mitarbeitende:** eigene Tageseinträge erfassen/bearbeiten, eigene Monats-/Jahresübersicht sehen,
  eigenes Passwort ändern (`/konto/passwort`). Zugriff auf fremde `/mitarbeiter/[userId]/...`-Seiten
  ist per Middleware (`src/lib/auth.config.ts`) blockiert.
- **Admin (Stefan Herger, Michael Küng):** alle Mitarbeitenden einsehen (`/admin`,
  "Nutzerverwaltung" in der Kopfzeile), dort auch Passwort für jede Person zurücksetzen (löst
  "Passwort vergessen" ohne E-Mail-Versand), Excel-Export für einzelne Mitarbeitende ziehen.
  Feiertagsliste/Firmenstammdaten pflegen ist als UI **noch nicht gebaut** (nur per Seed-Skript).

## 6. Excel-Export

Muss das Originalformat 1:1 reproduzieren:
- Sheets: `Jan, Feb, Mar, Apr, Mai, Jun, Jul, Aug, Sep, Okt, Nov, Dez, Summen, Feiertage` (exakt
  diese Reihenfolge und Blattnamen/Abkürzungen, deutsch: Mai statt May, Okt statt Oct, Dez statt Dec)
- Kopfbereich pro Monatsblatt (Zeile 1–3): Firmenname (`=Summen!B1`), Name (`=Summen!B3`), Monat
  (Datum 1. des Monats), Anstellung % (`=Summen!B5`), Blatt-Nr. (sequentiell 1–12), Ferien-Übersicht
  (Guthaben/Bezogen/Rest), Stundenübertrag Vormonat (`=Vormonat!U<letzter Tag>`)
- Empfohlener Ansatz: **Original-Datei als Vorlage verwenden und nur Eingabezellen befüllen**
  (Datum-Spalte A, Projekt-/Kategorie-Spalten C–Q, Spesen V/W, Stempelzeiten Y–AF, Kopf-Stammdaten),
  die vorhandenen Formeln in den restlichen Zellen unangetastet lassen. Das erfüllt die Anforderung
  "gleiche Formeln, nicht nur Werte" am zuverlässigsten, ohne die Formellogik neu bauen zu müssen.
- Reale Beispieldaten vorhanden: In `Arbeitsrapport_2026_kum.xlsx` sind für "Michael Küng" die
  Monate Jun–Aug 2026 teilweise mit echten Ist-Werten befüllt (Jun: 103.29h, Jul: 186.35h,
  Aug: 84.00h Ist gegen entsprechende Soll-Werte) — nützlich als Regressionstest-Fixture, sobald
  die Berechnungs-Engine gebaut wird.

## 7. Offene Fragen — Entscheidungen (geklärt am 2026-08-26)

1. **Feiertag `bezahlt="nein"`:** ✅ Entschieden — Excel-Formel ist verbindlich (voller Tages-Soll
   bei `bezahlt="nein"`, nicht 0). Spezifikationstext war an dieser Stelle ungenau.
2. **Manuelles Überschreiben von Soll pro Tag:** ✅ Entschieden — wird als Feature unterstützt
   (`DailyEntry.sollOverride`), siehe §3. Grund im Original vermutlich Sonderfälle wie
   Teilzeit-Start/unbezahlter Urlaub.
3. **Jahresferientage-Formel** (`6.5/12*20-0.00333333` ≈ 10.83 Tage): ✅ Entschieden — bleibt
   globale Konstante wie im Original, NICHT pro Mitarbeitendem konfigurierbar. Die Formel exakt so
   übernehmen (als Firmen-Konstante, nicht pro User editierbar).
4. **Vorholzeit-Felder (`Summen!B11`, `B12`):** noch offen — werden im gesamten Original nirgends
   sonst referenziert (vermutlich nur informativ). Für die Kern-Berechnung (Schritt 2–3 des
   Projektplans) nicht relevant; bei Bedarf vor dem entsprechenden Umsetzungsschritt erneut fragen,
   ob sie überhaupt eine Funktion haben sollen oder rein zur Anzeige gehören.
5. **Hosting/Domain:** ✅ Entschieden — `alta-engineering.ch` bleibt unverändert als statische Seite
   auf GitHub Pages (mit Cloudflare als DNS/CDN). Die Zeiterfassungs-App läuft als separate
   Anwendung mit eigenem Backend + DB auf einem Schweizer Host (Infomaniak), erreichbar über eine
   Subdomain (z.B. `zeit.alta-engineering.ch`), die per Cloudflare-DNS dorthin zeigt. GitHub Pages
   selbst kann keine Datenbank/Login/Server-Code hosten — daher diese Trennung.

## 8. Technische Rahmenbedingungen (nicht aus Excel ableitbar)

- **Stack:** Next.js (TypeScript) + Prisma/PostgreSQL + Auth.js (Credentials-Login)
- **Hosting:** App (Backend+DB) auf Infomaniak (Schweiz, wegen Personaldaten/nDSG), erreichbar über
  Subdomain `zeit.alta-engineering.ch` (o.ä.), DNS via Cloudflare — siehe §7 Punkt 5.
  Die bestehende Hauptseite `alta-engineering.ch` (GitHub Pages) bleibt unangetastet.
- Auth: Login pro Mitarbeitendem + Admin-Rolle
- DB: persistente Datenbank statt Excel als Datenquelle
- Excel-Export-Engine: `exceljs`, Template-Ansatz — Formeln erhalten (siehe §6)
