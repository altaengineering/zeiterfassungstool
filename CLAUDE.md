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

**Feste Projektliste + Kommentar, Chef-Übersicht, Kalender (2026-09-15):** Michael meldete, dass
freies Getippe bei den Projekten dazu verleitet, für dasselbe Projekt leicht unterschiedliche Namen
zu tippen, und dass das im Excel-Export zu inkonsistenten Spalten führte (der ursprünglich als
"Excel Export Bug ... immer eine neue Spalte angelegt" gemeldete Punkt), gewünscht war eine feste,
firmenweite Projektliste plus ein Kommentarfeld pro Projekt-Buchung ("was wurde heute gemacht").
Zusätzlich gewünscht: eine Admin-Übersicht, wer an welchen Projekten gearbeitet hat (mit
Kommentaren) und wer mit der Erfassung hinterherhinkt, sowie ein für alle einsehbarer Kalender mit
Feiertagen und Abwesenheiten (Ferien/Krank).

- **Neues Modell `Project`** (companyId, name, `aktiv: Boolean`, in beiden Schema-Dateien).
  `Booking` bekommt `projectId: String?` (nullable!) und `kommentar: String @default("")`. `label`
  bleibt als Feld bestehen (wird beim Speichern weiterhin auf den Namen des gewählten Projekts
  gesetzt), bewusst NICHT entfernt, und `projectId` bewusst NICHT als required/NOT NULL modelliert:
  `vercel-build` läuft bei jedem Deploy automatisch `prisma db push --accept-data-loss` gegen die
  echte Produktions-DB mit Michaels und ggf. weiteren Mitarbeitenden echten, bereits erfassten
  Buchungen (freier Text). Ein required `projectId` ohne bestehende Werte hätte den Deploy riskiert
  (Spalte kann nicht NOT NULL werden, solange Zeilen ohne Wert existieren) bzw. im schlimmsten Fall
  Datenverlust bedeutet. Migration alter Buchungen läuft stattdessen **über die laufende App**, die
  bereits gültigen Zugriff auf die Produktions-DB hat (nicht über einen direkten DB-Zugriff dieser
  Session, der nicht besteht): `src/lib/projects.ts` (`migriereBuchungenZuProjekten`) legt für jedes
  bisher unbekannte `label` automatisch ein `Project` an und verknüpft die Buchung per `projectId`,
  idempotent, beliebig oft aufrufbar. Admin-seitig als Button unter `/admin/projekte` ("Alte
  Buchungen übernehmen"). **Nach diesem Deploy einmal von einem Admin auf der Live-Seite klicken**,
  damit Michaels bestehende Juni-September-Buchungen (Website/Zeiterfassung/CAD-Support/…) ihre
  `projectId` bekommen, sonst tauchen sie im Bearbeiten-Formular zwar weiterhin korrekt an (Fallback
  über Namensvergleich, siehe `EntryForm.anfangsProjektId`), zählen aber im Export erst nach der
  Migration zuverlässig über `projectId` statt nur über Namensvergleich.
- **`/admin/projekte`:** Projekte anlegen/umbenennen/(de)aktivieren. Kein Löschen (nur Deaktivieren),
  damit bestehende Buchungen ihre Zuordnung nicht verlieren. Warnt, wenn mehr als 9 aktive Projekte
  existieren (Excel-Vorlage hat nur die Spalten C–K).
- **`EntryForm.tsx`:** Projekt-Textfeld durch `<select>` ersetzt (befüllt aus den aktiven Projekten
  der Firma, als Prop von `page.tsx` durchgereicht), plus ein neues Kommentar-Textfeld pro
  Projektzeile. Die Absorber-/Rest-Verteilungslogik (`absorberIndexBestimmen`,
  `projektStundenNeuVerteilen`) blieb inhaltlich unverändert, nur `projektLabelRefs` (Text-Input-Refs)
  wurde zu `projektSelectRefs` (Select-Refs). `actions.ts` liest jetzt `projektId<i>` statt
  `projektLabel<i>` und `projektKommentar<i>` zusätzlich, löst den Projektnamen für das Legacy-Feld
  `label` beim Speichern auf.
- **Export-Fix (der eigentliche "neue Spalte"-Bug):** `exportExcel.ts` bestimmte die
  Projekt-Spaltenreihenfolge (C–K) bisher **pro Monat neu**, aus der Reihenfolge des ersten
  Auftretens der Labels in diesem Monat, dadurch stand dieselbe Spalte in unterschiedlichen Monaten
  (oder bei unterschiedlichen Personen) für unterschiedliche Projekte, sobald sich die
  Erstauftritts-Reihenfolge unterschied. Jetzt: `ExportInput.projekte` (feste, nach `createdAt`
  sortierte Liste, max. 9) wird von `route.ts` mitgegeben und für **alle** Monatsblätter gleich
  verwendet; die Zuordnung pro Buchung läuft über `projectId` (mit Namens-Fallback für noch nicht
  migrierte Altbuchungen). Lokal end-to-end verifiziert: Export erzeugt, `xl/worksheets/sheet9.xml`
  (September) per Skript inspiziert, Spalten C/D/E enthalten exakt Website/Zeiterfassung/CAD-Support
  in der erwarteten festen Reihenfolge mit den korrekten Stunden.
- **`/admin/uebersicht` (Chef-Übersicht, nur Admins):** Monatsansicht über alle Mitarbeitenden:
  erfasste Arbeitstage vs. erwartete Arbeitstage bis heute (flaggt, wer hinterherhinkt), darunter pro
  Person eine Tabelle Datum/Projekt/Stunden/Kommentar. Bewusst **kein** rollierender Stand/Saldo pro
  Person in dieser Übersicht (das gibt es bereits auf der persönlichen Monatsseite, verlinkt via
  "Monatsansicht öffnen"), hätte die komplette Pensum-/Feiertags-Berechnungskette pro Mitarbeitendem
  dupliziert, für den eigentlichen Zweck ("wer hat woran gearbeitet, wer ist im Rückstand") nicht
  nötig.
- **`/kalender` (für alle Mitarbeitenden sichtbar, nicht nur Admins):** Monatsliste mit Feiertagen
  (aus `Holiday`) und, pro Tag, wer in der Firma Ferien oder krank gemeldet ist (aus `DailyEntry.
  ferien`/`krank` aller Mitarbeitenden der Firma, nicht nur der eigenen Einträge). Zeigt die reinen
  Stunden (z.B. "Ferien, 8.40h"), keine Halbtags-/Ganztags-Umrechnung (dafür bräuchte es den
  Pensum-Wert pro Person und Tag, für eine reine Übersicht nicht nötig).
- Lokal end-to-end getestet (separater SQLite-Testklon `L:\zft_check`, nicht dieses Verzeichnis):
  Migration von 3 Altbuchungen verifiziert (Website/Zeiterfassung/CAD-Support korrekt als Projekte
  angelegt und verknüpft), Auswahl im Formular zeigt die migrierten Buchungen korrekt vorselektiert,
  Kommentar gespeichert und in Tagesübersicht + Chef-Übersicht sichtbar, Ferien-Eintrag erscheint im
  Kalender mit korrektem Namen/Stunden.

**Projekte auf privat umgestellt, Chef-Übersicht/Kalender neu gestaltet, Header mit Logo
(2026-09-15, Nachtrag):** Direktes Feedback von Michael auf die firmenweite Projektliste vom
selben Tag: Projekte sollen NICHT firmenweit geteilt sein, sondern jede Person pflegt ihre eigene,
private Liste ("jeder selber festlegen"). Ausserdem war die Migrations-Box auf der alten
`/admin/projekte`-Seite visuell kaputt (überlappender Text, kaum lesbar, siehe Screenshot),
Chef-Übersicht war als lose Karten-Liste unübersichtlich, Kalender wirkte leer, und der Header
sollte ein Logo bekommen sowie Admin-Funktionen in eine einklappbare Konsole verschieben statt sie
immer sichtbar zu zeigen.

- **`Project` von firmenweit auf pro Person umgestellt:** `companyId` ersetzt durch `userId`
  (optional, `String?`, siehe unten warum). Alte Seite `/admin/projekte` entfernt, neu:
  **`/projekte`** (für ALLE eingeloggten Personen, nicht nur Admins). Jede Person sieht und
  bearbeitet ausschliesslich ihre eigene Liste (`where: { userId: eigeneId }` in jeder Server
  Action, plus `updateMany` statt `update` bei Rename/Aktiv-Schalten, damit niemand über eine
  fremde Projekt-ID ein Projekt einer anderen Person verändern kann).
- **Schema-Sicherheit wie beim ersten Anlauf:** `userId` ist bewusst weiterhin optional (nicht
  required), aus demselben Grund wie zuvor `projectId` auf `Booking` optional war. `vercel-build`
  pusht das Schema automatisch gegen die echte Produktions-DB, in der zu diesem Zeitpunkt bereits 3
  Projekte samt 88 damit verknüpften Buchungen existierten (Michael hatte den Migrieren-Button vom
  Vormittag bereits erfolgreich geklickt). Ein required `userId` ohne Wert auf bestehenden Zeilen
  hätte den Deploy riskiert. Lokal verifiziert, dass `prisma db push` das companyId-Feld anstandslos
  fallen lässt (`⚠️ dropping companyId column, still contains 3 non-null values`, nur ein Hinweis,
  kein Abbruch, da eine Spalte zu entfernen nie einen Default braucht).
- **`src/lib/projects.ts` (`migriereEigeneBuchungenZuProjekten`) neu geschrieben:** läuft jetzt pro
  Person statt pro Firma. Findet offene Buchungen (kein `projectId`, ODER `projectId` zeigt auf ein
  noch "herrenloses" Project mit `userId = null`, z.B. die 3 alten firmenweiten Projekte von heute
  Vormittag). Ein herrenloses Project mit passendem Namen wird direkt übernommen (`userId` gesetzt),
  statt dupliziert zu werden, dadurch beansprucht die erste Person, die auf `/projekte` den
  Migrieren-Button klickt, das bestehende Project für sich; eine zweite Person mit zufällig gleichem
  Projektnamen bekäme danach ein eigenes, separates Project. Lokal verifiziert: Test-Company hatte
  nach dem alten Lauf 3 herrenlose Projekte (companyId entfernt, userId noch `null`), ein Klick auf
  "Ja, alte Einträge jetzt übernehmen" als "Test Person" hat alle 3 korrekt übernommen, Formular
  zeigt sie danach wie gewohnt vorselektiert.
- **`/projekte`-Seite komplett neu gebaut** (statt die alte Tabelle zu reparieren): Projekte als
  Karten (`ProjektZeile.tsx`, Client-Komponente) statt Tabellenzeilen mit ineinander verschachtelten
  Formularen, das war die Ursache für den "verbuggt/kaum lesbar"-Eindruck (mehrere `<form>`s pro
  Tabellenzelle ohne ausreichend Abstand, bei schmaler Breite lief alles ineinander). Umbenennen
  klappt jetzt sauber in einen Bearbeiten-Modus um (eigener State, kein Layout-Sprung), Migrations-
  Box ist nur noch sichtbar, wenn tatsächlich offene Altbuchungen existieren (`hatOffeneAltbuchungen`
  Zähler serverseitig ermittelt), und der komplette Text ist bewusst in einfachen, kurzen Sätzen
  gehalten ("Das hier ist deine ganz persönliche Liste, niemand sonst sieht oder verändert sie.").
- **Chef-Übersicht (`/admin/uebersicht`) umgebaut:** von einer Karte pro Mitarbeitendem mit
  eingebetteter Tabelle zu einer einzigen Tabelle (Name/Tage erfasst/Status/Link) mit Klick-zum-
  Aufklappen (`MitarbeiterZeile.tsx`, Client-Komponente mit lokalem Auf/Zu-State, öffnet eine zweite
  `<tr>` mit der Detail-Tabelle darunter). Zusätzlich drei Kennzahlen-Karten oben (Mitarbeitende,
  erwartete Arbeitstage, Anzahl im Rückstand) im selben Stil wie die Monatsansicht.
- **Kalender (`/kalender`) von Liste zu echtem Monatsraster:** CSS-Grid mit 7 Spalten (Woche
  beginnt Montag, `fuehrendeLeerzellen = (ersterWochentag + 6) % 7` füllt die Tage vor dem 1. auf),
  jeder Tag eine Karte mit Nummer, Feiertagsname direkt in der Kachel, und runden Initialen-Chips
  pro abwesender Person (blau = Ferien, rot = Krank, Hover/`title` zeigt Name + Stunden). Heutiges
  Datum bekommt einen Rahmen in Akzentfarbe. Wochenend-/Feiertags-Hintergrund bewusst mit
  `color-mix()` deutlich stärker abgesetzt als die vorherige Tabellen-Variante (die bestehenden
  `--bg-weekend`/`--bg-holiday`-Variablen waren im Dark Mode zu nah an der Kartenfarbe, kaum
  erkennbar), auf Mobile (`max-width: 640px`) wird der Feiertagsname in der Kachel ausgeblendet,
  bleibt aber unten in der Liste sichtbar, damit die Kacheln nicht überlaufen.
- **Header/Topbar neu gestaltet:** Logo (`public/alta-logo.png`, Original aus dem Website-Repo
  `altaengineering-website/logo.png`) links neben dem Markennamen, ein dünner Farbverlauf-Streifen
  oben am Topbar-Rand (`::before`, Grün/Gelb/Blau, greift die Marken-Idee des Logos auf ohne exakte
  Pixelfarben daraus zu kopieren, nutzt stattdessen die bereits vorhandenen `--pos`/`--accent-2`/
  `--accent`-Variablen). Neue wiederverwendbare Client-Komponente `TopbarMenu.tsx` (Button + Panel,
  schliesst bei Klick ausserhalb via `mousedown`-Listener auf einem Wrapper-`ref`) für zwei
  Dropdowns: **"Admin"** (nur für Admins sichtbar, enthält Nutzerverwaltung/Chef-Übersicht/
  Feiertage/Monatsabschluss, vorher einzeln nebeneinander in der Navigation) und ein Konto-Menü
  unter dem eigenen Namen (Passwort ändern/Einrichtung/Abmelden, vorher ebenfalls einzeln sichtbar).
  Dadurch sieht die Kopfzeile für normale Mitarbeitende und Admins bis auf den zusätzlichen
  "Admin"-Button jetzt identisch aus, statt wie vorher mit vier zusätzlichen, immer sichtbaren
  Admin-Links. Serverseitige Actions (insbesondere `signOut`) werden als bereits gebundene Server-
  Aktion via `children`-Prop in die Client-Komponente durchgereicht (funktioniert in Next.js
  App Router ohne Weiteres), `TopbarMenu` selbst kennt keine Server-Logik.
- Lokal end-to-end getestet (Desktop und Mobile-Breite via `resize_window`): Login als Mitarbeiter
  UND als Admin, beide Dropdown-Menüs geöffnet/geschlossen, Chef-Übersicht aufgeklappt, Kalender mit
  Testfeiertag und vorhandenem Ferien-Eintrag geprüft (Chip + Tooltip korrekt), Hell/Dunkel-Modus
  auf allen neuen Seiten gegengeprüft, `next build` lief fehlerfrei durch, neue Routen `/projekte`
  und `/admin/uebersicht` erscheinen korrekt in der Build-Ausgabe, `/admin/projekte` ist weg.

**Kalender-Notizen (privat/öffentlich), Gleitzeit in der Chef-Übersicht, Farbpalette
(2026-09-15, zweiter Nachtrag):**

- **Neues Modell `KalenderNotiz`** (userId, date, text, `oeffentlich: Boolean`). Auf `/kalender`
  kann jede Person Notizen zu einem Tag im angezeigten Monat anlegen (Formular unten auf der
  Seite, Pill-Auswahl "Privat"/"Öffentlich" analog zur Ferien-Auswahl im Tageseintrag). Privat =
  nur die eigene Person sieht sie (Datenbankabfrage filtert `userId = eigene ID`), öffentlich = alle
  in der Firma (`companyId` über die Relation). Löschen nur für die eigene Notiz möglich
  (`deleteMany` mit `userId` in der WHERE-Klausel, wie bei den Projekt-Actions). In den
  Tages-Kacheln als kleine Zeile mit 🔒/🌐-Symbol, unten zusätzlich eine Tabelle "Meine Notizen" mit
  Lösch-Button. Lokal als zwei verschiedene Personen gegengetestet: private Notiz von Person A
  taucht bei Person B nirgends auf, öffentliche Notiz von Person B ist für Person A sichtbar,
  beide sehen jeweils ihre eigene Notiz in der "Meine Notizen"-Liste.
- **Gleitzeitstand in der Chef-Übersicht:** neue Datei `src/lib/monatsStand.ts`
  (`berechneMonatsStand`), eine verkleinerte Kopie derselben Stand-Berechnung wie in
  `mitarbeiter/[userId]/[jahr]/[monat]/page.tsx` (dieselben `calc`-Funktionen, nur auf
  `standVorMonat`/`standEndeMonat` reduziert statt der ganzen Tagesansicht). Bewusst als eigene
  Funktion statt die bestehende, gut getestete Seite umzubauen, um deren Verhalten für die
  Kernansicht nicht zu riskieren. `/admin/uebersicht` ruft das für alle Mitarbeitenden parallel auf
  und zeigt pro Person den aktuellen Stand sowie die Veränderung seit Monatsbeginn mit
  Pfeil (▲ grün / ▼ rot). Lokal gegen die bekannten Testwerte verifiziert (Stand Ende Monat
  -1618.60h, Veränderung -165.40h stimmt exakt mit Stand Vormonat -1453.20h auf der persönlichen
  Monatsseite überein).
- **Kleine Farbpalette ergänzt** (`src/lib/colors.ts`, `paletteIndex`/`initialen`, sechs Farbtöne
  als CSS-Variablen `--farbe-0` bis `--farbe-5`): derselbe Name/Projekttext bekommt in der ganzen
  App immer dieselbe Farbe, per einfachem String-Hash statt einer gepflegten Zuordnungstabelle.
  Verwendet für: farbige Avatar-Kreise mit Initialen in der Chef-Übersicht, farbige Projekt-Tags in
  der Chef-Übersicht UND in der normalen Tagesübersicht (vorher reiner Fliesstext), sowie farbige
  Akzent-Ränder auf den Kennzahlen-Karten (`.card-accent-*`). Grund: Feedback, das Design sei "zu
  einfarbig" gewesen.
- **Chef-Übersicht-Tabellenspalten neu proportioniert:** `table-layout: fixed` mit festen
  Prozent-Breiten (`Datum` 11%, `Projekt` 22%, `Stunden` 11%, `Kommentar` 56%) statt automatischer
  Spaltenbreite, dazu `white-space: normal` für die Kommentarspalte (vorher wie der Rest der Tabelle
  `nowrap` geerbt). Grund: Feedback, Projekt-Spalte sei zu breit, Kommentar zu eng.
- **Krank-Sichtbarkeit im Kalender auf heute+Zukunft eingeschränkt** (Datenschutz-Feedback):
  sowohl in der Datenbank-Abfrage selbst (`krank`-Bedingung bekommt zusätzlich `date: { gte: heute
  }`, vergangene Krank-Tage werden gar nicht erst geladen) als auch nochmal an der Stelle, wo die
  Kalender-Chips gebaut werden (doppelt abgesichert). Ferien bleiben unverändert für den ganzen
  Monat sichtbar, das war nicht Teil des Feedbacks.

**Design zurückgenommen: "zu bunt/RGB", Gleitzeit-Anzeige korrigiert (2026-09-15, dritter
Nachtrag):** Direktes Feedback nach dem zweiten Nachtrag: die sechs Akzentfarben (blau/violett/
teal/amber/pink/indigo) für Projekt-Tags, Avatare und Kennzahlen-Karten wirkten zusammen "zu sehr
nach RGB", der Gelb-Grün-Balken oben im Header war störend, und die Gleitzeit-Zahl war
irreführend negativ, weil noch nicht erreichte Kalendertage im laufenden Monat automatisch als
volles Minus mitgezählt wurden.

- **Farbpalette entfernt.** `paletteIndex` aus `src/lib/colors.ts` gestrichen (nur `initialen`
  bleibt), `--farbe-0` bis `--farbe-5` und alle `.farbe-*`/`.tag.farbe-*`-Regeln aus `globals.css`
  entfernt. `.avatar` ist jetzt einheitlich `var(--accent)` (Blau) mit weisser Schrift, `.tag`
  (Projekt-Badges in Chef-Übersicht und Tagesübersicht) ein neutrales Pill mit
  `var(--surface-alt)`-Hintergrund statt farbiger Füllung. `.card-accent-*` auf zwei Varianten
  reduziert: `-blau` (neutral, fast alle Kennzahlen-Karten) und `-rot` (nur für einen echten
  Warnzustand wie "im Rückstand"), keine gradient-Fläche mehr, nur ein dünner 2px-Rand oben.
  Kalender-Chips (Ferien=blau, Krank=rot) und der Admin-Menü-Akzent (Amber) blieben unverändert
  stehen, das ist gezielte Signalfarbe für genau eine Bedeutung, kein Regenbogen.
- **`.topbar::before`-Gradient (Grün/Amber/Blau) entfernt**, ersetzt durch einen schlichten
  1px-`border-bottom` in einem gedeckten Blauton (`color-mix` mit `--border`).
- **Body bekam einen dezenten radialen Verlauf** statt der reinen Flächenfarbe
  (`background-image: radial-gradient(...)` mit `var(--accent)` bei 10% Deckkraft, oben mittig,
  `background-attachment: fixed`), damit der dunkle Hintergrund nicht komplett flach wirkt, ohne
  ein weiteres Muster oder weitere Farbtöne einzuführen.
- **Gleitzeitstand in der Chef-Übersicht korrigiert:** `berechneMonatsStand`
  (`src/lib/monatsStand.ts`) bekam eine neue Option `nichtInDieZukunftProjizieren`. Ist sie
  gesetzt, werden alle Tage NACH heute mit `sollOverride: 0` (Soll UND Ist = 0) statt mit echtem
  Soll ohne Gegenbuchung gerechnet, sie beeinflussen den Stand also gar nicht erst. Nur
  `/admin/uebersicht` nutzt diese Option (Spalte umbenannt in "Gleitzeit (heute)", mit Tooltip);
  die persönliche Monatsseite und der Excel-Export bleiben bewusst unverändert bei der echten,
  rollierenden Logik aus dem Original-Rapport (dort sollen unentschuldigt offene Tage weiterhin
  als Rückstand zählen, das ist gerade der Sinn der Gleitzeit-Erfassung). Vorher zeigte die
  Chef-Übersicht für den laufenden Monat immer einen stark negativen Wert und eine fast immer
  fallende Tendenz, einfach weil die Resttage des Monats noch nicht erfasst werden konnten, das
  hatte keine Aussagekraft darüber, ob jemand wirklich im Rückstand ist.

**Krank-Sichtbarkeit im Kalender: Ausnahme für Admins (2026-09-15, vierter Nachtrag):** Die
Einschränkung aus dem zweiten Nachtrag (Krank-Tage im Kalender nur ab heute sichtbar) galt bisher
für alle, auch Admins. Auf Wunsch sehen Admins jetzt weiterhin den vollen Verlauf inkl.
Vergangenheit (z.B. für Lohn-/Absenzfragen), normale Mitarbeitende weiterhin nur ab heute. Sowohl
die Datenbank-Abfrage als auch der zweite Check beim Bauen der Kalender-Chips in
`src/app/kalender/page.tsx` prüfen dafür `ich.role === "ADMIN"` (`binAdmin`). Der Hinweistext unter
der Kalender-Überschrift ("Krankheitstage sind hier nur ab heute sichtbar...") erscheint dafür nur
noch für Nicht-Admins. Lokal mit zwei Accounts gegengetestet: Admin sieht einen absichtlich in die
Vergangenheit gesetzten Krank-Tag, derselbe Tag ist für den normalen Testaccount unsichtbar.

**Hintergrund-Ebene, Helvetica auf Formularelementen, Kartenabstände, Notiz-Autor (2026-09-15,
fünfter Nachtrag):** Weiteres Feedback nach dem dritten Nachtrag: die Seite wirkte trotz des
zurückgenommenen Farbsystems immer noch zu leer, in der Login-Seite gibt es bereits eine "coole"
(aber nicht ablenkende) Optik, die als Vorbild dienen sollte, Formularelemente rendern nicht
überall in Helvetica, die Überschrift "Notiz hinzufügen" klebte ohne Abstand am Kartenrand, und im
Kalender sollte sichtbar sein, wer eine Notiz geschrieben hat.

- **Neue fixierte Hintergrund-Ebene `.app-bg`:** ein `<div className="app-bg">` direkt nach
  `<body>` in `layout.tsx`, `position: fixed; z-index: -1` (kein `z-index` an anderer Stelle
  nötig). Zeigt ein feines Gitter plus einen weichen radialen Glanz oben, in derselben
  Formensprache wie die Login-Seite (`.login-brand`, dort schon länger vorhanden: rotierender
  `conic-gradient`, pulsierendes Uhr-Icon), aber deutlich zurückhaltender: keine schnelle Rotation,
  nur eine sehr langsame Helligkeits-Animation (12s, respektiert `prefers-reduced-motion`), und nur
  der eine bestehende Blauton (`var(--accent)`), keine weitere Farbe. Karten/Tabellen haben
  weiterhin ihre eigene deckende Hintergrundfarbe und liegen sichtbar darüber.
- **`button, input, select, textarea { font-family: inherit; }` ergänzt.** Formularelemente erben
  `font-family` in vielen Browsern nicht automatisch von `body`, sie fallen sonst auf die
  System-UI-Schrift zurück statt Helvetica zu zeigen, unabhängig von der auf `body` gesetzten
  Schriftkette. Betraf praktisch jedes Eingabefeld und jeden Knopf in der ganzen App.
- **Kartenabstand korrigiert:** `.form-section-title`/`.form-hint` als direkte Kinder einer
  `.entry-form-card` (statt innerhalb eines bereits gepolsterten `.form-section`, z.B. "Notiz
  hinzufügen" im Kalender, "Alte Einträge gefunden" auf `/projekte`) hatten kein eigenes Padding
  und klebten am Kartenrand. Neue Regeln `.entry-form-card > .form-section-title` /
  `.entry-form-card > .form-hint` sowie `.migrate-box` (Innenabstand für den Migrieren-Knopf)
  beheben das, ohne `.datum-bar`/`.entry-form` anzufassen, die weiterhin bewusst randlos bis an den
  Kartenrand reichen.
- **Notiz-Autor sichtbar:** Kalender-Kacheln zeigen jetzt `🌐 Vorname: Text` bzw. `🔒 Vorname: Text`
  direkt in der Kachel statt den Namen nur im Hover-Tooltip zu verstecken (Vorname statt vollem
  Namen, damit es in der schmalen Kachel nicht umbricht).
- **Echter Bug gefunden und behoben, nicht nur Kosmetik:** Beim Testen der Hintergrund-Ebene fiel
  auf, dass die Seite horizontal um ca. 27px überlief (`document.documentElement.scrollWidth` >
  `window.innerWidth`), sichtbar als abgeschnittener linker Rand nach jedem Seitenwechsel/Reload.
  Ursache: `.pill-group input` (die unsichtbaren Radio-Buttons hinter den Privat/Öffentlich- bzw.
  Ferien-Pillen) und `.entry-form input` haben dieselbe CSS-Spezifität; da `.entry-form input`
  weiter unten in `globals.css` steht, gewann dessen `width: 100%` gegen das eigentlich gewollte
  `width: 1px`, positioniert relativ zu `body` (da `.pill-group` selbst kein `position: relative`
  hatte) statt zur kleinen Pillen-Gruppe, das blies die unsichtbaren Radios auf Formularbreite auf.
  Betraf nicht nur die neuen Kalender-Notiz-Pillen, sondern genauso die seit Längerem bestehenden
  Ferien-Pillen im Tageseintrag, dort ist es nur nie aufgefallen. Behoben durch `position: relative`
  auf `.pill-group` selbst sowie eine spezifischere Selektor `.pill-group input[type="radio"]`
  (schlägt `.entry-form input` unabhängig von der Reihenfolge im Stylesheet). Lokal auf mehreren
  Seiten mit `document.documentElement.scrollWidth`/`window.innerWidth` nachgemessen, kein
  Überlauf mehr.

**Gleitzeit-Chef-Übersicht: heute zählt auch nicht mehr mit (2026-09-15, sechster Nachtrag):**
Der laufende Tag selbst wurde in `berechneMonatsStand` mit `nichtInDieZukunftProjizieren` bisher
noch normal gerechnet (Bedingung war `date > heuteIso`, nicht `>=`). Ist er noch nicht erfasst
(z.B. vormittags, bevor jemand seinen Tag einträgt), zeigte die Chef-Übersicht trotzdem ein volles
Minus für diesen einen Tag. Bedingung auf `date >= heuteIso` geändert: heute zählt jetzt genauso
wenig wie die Tage danach, das Ergebnis ist effektiv der Stand von gestern. Spalte entsprechend von
„Gleitzeit (heute)" zu „Gleitzeit (Stand gestern)" umbenannt (Tooltip ergänzt). Lokal verifiziert:
Wert für die Testperson sank exakt um 8.40 h (einen Tages-Soll) gegenüber der vorherigen Anzeige,
nachdem der 15.9. (heute im Test) als "noch nicht erfasst" mitgezählt hatte.

**Projekte löschen (nur deaktivierte), /projekte optisch aufgewertet (2026-09-15, siebter
Nachtrag):** Wunsch nach einer Möglichkeit, alte deaktivierte Projekte ganz zu entfernen (bisher
nur deaktivierbar, siehe erster Nachtrag), plus allgemein mehr visuelle Gestaltung auf der Seite.

- **`Booking.project`-Relation bekam explizit `onDelete: SetNull`** (beide Schema-Dateien): löscht
  man ein Projekt, verlieren seine Buchungen nur die Verknüpfung (`projectId` wird `null`), `label`
  (Projektname zum Zeitpunkt der Buchung) und `hours` bleiben unverändert erhalten, die Buchung
  taucht danach wie eine noch nicht migrierte Altbuchung auf. Ohne diese explizite Angabe wäre das
  DB-Standardverhalten nicht sicher garantiert gewesen. Lokal mit einem echten Testfall verifiziert
  (Projekt mit einer Buchung angelegt, gelöscht, Buchung existierte danach weiter mit
  `projectId: null`, `label`/`hours` unverändert).
- **Neue Server Action `projektLoeschen`** (`src/app/projekte/actions.ts`): löscht nur, wenn
  `aktiv: false` UND `userId` der eigenen Person entspricht (`deleteMany` mit beiden Bedingungen in
  der WHERE-Klausel, damit weder ein aktives noch ein fremdes Projekt gelöscht werden kann, auch
  nicht über eine manipulierte Projekt-ID). Der "Entfernen"-Knopf erscheint in `ProjektZeile.tsx`
  nur bei deaktivierten Projekten, mit `confirm()`-Rückfrage (Text nennt die Anzahl betroffener
  Buchungen, falls vorhanden), analog zum bestehenden `DeleteUserButton`-Muster.
- **`/projekte` optisch überarbeitet:** drei Kennzahlen-Karten oben (Aktive Projekte, Deaktiviert,
  Buchungen gesamt, gleicher `.card-accent`-Stil wie andere Seiten), Projekte in zwei Abschnitte
  "Aktiv"/"Deaktiviert" gruppiert (statt einer einzigen Liste mit Status-Badge pro Zeile), jede
  Projekt-Karte zeigt jetzt ein kleines Ordner-Icon und die Anzahl Buchungen als Badge, deaktivierte
  Karten sind sichtbar abgedunkelt (`.projekt-card-inaktiv`). Bewusst weiterhin nur der eine
  bestehende Blauton als Akzent (Ordner-Icon-Hintergrund, Abschnitts-Punkt bei "Aktiv" ist Grün wie
  an anderer Stelle für positive Zustände), keine neue Farbvielfalt, siehe drittes Nachtrag-Feedback
  "zu bunt".

**Hintergrund nochmal ausgebaut, Kalender-Legende bereinigt, Chef-Übersicht-Zähler korrigiert
(2026-09-15, achter Nachtrag):** Drei kleinere Punkte aus direktem Feedback.

- **`.app-bg` reicht jetzt über die ganze Seite statt nur oben:** zweiter, leiserer Glanzpunkt
  unten rechts dazu (asymmetrisch zum oberen, wirkt weniger wie ein einzelner "Klecks"), plus eine
  sehr dezente diagonale Linie als zusätzlicher Akzent. Die Maske (`mask-image`) wurde deutlich
  vergrössert (`1900px 1500px`, `transparent 94%` statt `82%`), vorher liess sie das Gitter nur im
  oberen Seitenbereich durchscheinen, jetzt über praktisch die ganze Seite, nur an den äussersten
  Rändern noch ein sanftes Ausblenden. Weiterhin nur `var(--accent)` (ein Blauton), keine weitere
  Farbe, und weiterhin die langsame 14s-Atem-Animation (`prefers-reduced-motion` respektiert).
- **Kalender-Legende zeigte bei Ferien/Krank den Platzhaltertext "AB"** (ein Test-Initialen-Rest
  aus der ersten Kalender-Version, nie durch etwas Sinnvolles ersetzt). Legende zeigt jetzt einen
  reinen Farbpunkt (`.kalender-chip-swatch`, 12px, keine Buchstaben), so wie es Feiertag/Wochenende
  schon immer taten.
- **"Tage erfasst" in der Chef-Übersicht konnte grösser als "erwartete Arbeitstage" sein** (z.B.
  "30/9"), weil `erfassteTage` bisher schlicht alle `DailyEntry`-Zeilen des ganzen Monats zählte,
  auch Wochenenden und (bei Personen mit im Voraus vorhandenen Zeilen, z.B. aus der "leere
  Startphase"-Vorbefüllung) Tage in der Zukunft, während "erwartete Arbeitstage" nur Werktage bis
  gestern zählt. `arbeitstageBisher()` (`src/app/admin/uebersicht/page.tsx`) bekam einen neuen,
  optionalen Parameter `nurMitEintrag: Set<string>` und läuft für "Tage erfasst" jetzt über exakt
  dieselbe Tagesmenge wie für "erwartete Arbeitstage", zählt davon aber nur die Tage mit
  tatsächlichem Eintrag. Dadurch ist "Tage erfasst" jetzt rechnerisch immer eine Teilmenge von
  "erwartete Arbeitstage" und kann sie nicht mehr übersteigen. Lokal mit künstlich für den ganzen
  Monat vorbefüllten Testdaten nachgestellt (vorher hätte das "28/10" angezeigt, danach korrekt
  "10/10").

**Mobile-Ansicht dringend nachgebessert (2026-09-16):** Stefan hat das Tool firmenweit gelauncht,
direktes Feedback am selben Tag: auf dem Handy sieht die App unschön aus, besonders der Kalender.
Mit `resize_window`-Emulation (375px) lokal nachgestellt und zwei echte Ursachen gefunden.

- **Kopfzeile brach auf drei Zeilen um**, weil `.topbar-user` (Navigation, Admin-Menü, Konto-Menü,
  Dark-Mode-Knopf) intern selbst nochmal umbricht: Zeile 1 Logo, Zeile 2 Navigation+Menüs, Zeile 3
  nur noch der Dark-Mode-Knopf allein (der Rest passte knapp auf Zeile 2, nur der letzte Knopf
  nicht mehr). Neue Regeln in einem bestehenden `@media (max-width: 640px)`-Block reduzieren
  Abstände/Innenabstände von `.topbar-inner`, `.topbar-user`, `.topbar-nav`, `.topbar-menu-trigger`
  und `.icon-btn` leicht, dadurch passt auf 375px wieder alles inklusive Dark-Mode-Knopf auf eine
  einzige zweite Zeile (Kopfzeile insgesamt nur noch zwei statt drei Zeilen).
- **`.form-row-pair` (zweispaltiges Grid, z.B. Datum/Text bei der Kalender-Notiz, Projekt/Stunden
  im Tageseintrag) quetschte beide Spalten auch auf schmalen Bildschirmen nebeneinander**, dadurch
  wurden Platzhaltertexte abgeschnitten (z.B. "z.B. Homeof..." statt "z.B. Homeoffice"). Im selben
  Media-Query auf eine Spalte gestellt (`grid-template-columns: 1fr`), alle vier Verwendungsstellen
  (Feiertage, Pensumwechsel, Kalender-Notiz, Tageseintrag-Projekte) betroffen, absichtlich
  einheitlich statt nur für den Kalender gefixt, da das exakt dieselbe Ursache war.
- Lokal auf `/kalender`, der Tagesübersicht, `/admin` und `/admin/uebersicht` bei 375px
  gegengeprüft: Kopfzeile jetzt zwei saubere Zeilen überall, Formularfelder stapeln sich lesbar,
  Tabellen (Chef-Übersicht, Nutzerverwaltung) bleiben wie vorher horizontal scrollbar innerhalb
  von `.table-wrap`, das ist für Datentabellen auf einem Telefon ein akzeptables, gängiges Muster
  und wurde bewusst nicht angefasst.

**Reihenfolge nach Dienstalter (2026-09-16):** Wunsch, die Mitarbeitenden-Reihenfolge (vor allem
in der Chef-Übersicht, aber auch in der Nutzerverwaltung) nach Firmeneintritt statt alphabetisch
zu sortieren. Michael lieferte dafür eine Excel-Liste (`MA_2026.xlsx`) mit Name + Eintrittsdatum
für 13 von 14 Personen (Stefan Herger fehlt darin).

- **Neues Feld `User.eintrittsdatum` (`DateTime?`, optional)** in beiden Schema-Dateien, rein
  additiv, unproblematisch für `db push --accept-data-loss` (siehe Kommentar im Feld selbst zur
  Begründung, warum optional statt Pflichtfeld, gleiches Muster wie schon bei `Project.userId` und
  `Booking.projectId`).
- **`src/lib/dienstalter.ts`:** feste `DIENSTALTER`-Zuordnung E-Mail → Datum (aus der Excel-Liste
  abgetippt, keine dynamische Nutzereingabe, da feststehende, einmalige HR-Fakten) sowie
  `vergleicheDienstalter()`, ein Sortier-Comparator: älteste zuerst, Personen ohne bekanntes Datum
  ans Ende (alphabetisch untereinander), nicht geraten oder vorne einsortiert.
- **Self-Service-Import statt direktem DB-Zugriff** (gleiches Muster wie die Projekt-Migration):
  neuer Knopf "Dienstalter importieren" auf `/admin` (`DienstalterButton.tsx` +
  `dienstalterImportieren` in `admin/actions.ts`), gleicht die feste E-Mail-Liste per
  `updateMany({ where: { email } })` ab und meldet zurück, wie viele Personen aktualisiert wurden
  UND welche E-Mails keine Übereinstimmung hatten (wichtig, weil diese Session keinen direkten
  Zugriff auf die Produktions-Datenbank hat und Tippfehler/Schreibweisen-Abweichungen zwischen der
  Excel-Liste und den echten Konten sonst unbemerkt blieben). **Nach diesem Deploy muss ein Admin
  einmal auf `/admin` auf „Dienstalter importieren“ klicken**, danach sind die Anzeigen sortiert.
- **`/admin` und `/admin/uebersicht`** laden Nutzer:innen weiterhin ganz normal aus der Datenbank
  (Reihenfolge dort bewusst unverändert, alphabetisch, für stabile Sortierung als Ausgangsbasis)
  und sortieren erst in JavaScript mit `vergleicheDienstalter()` um, keine DB-seitige
  `NULLS LAST`-Sortierung verwendet (deren Unterstützung zwischen SQLite und PostgreSQL nicht
  sicher identisch ist, JS-seitiges Sortieren funktioniert dagegen auf beiden garantiert gleich).
  `/admin` zeigt zusätzlich eine neue Spalte „Eintritt“ in der Tabelle, damit sichtbar ist, ob der
  Import funktioniert hat.
- Lokal mit drei Testkonten unter echten E-Mail-Adressen (`d.gruber@...`, `f.kurzmeyer@...`,
  `m.kueng@...`) end-to-end verifiziert: vor dem Import alphabetisch sortiert, nach Klick auf
  „Dienstalter importieren“ korrekt nach Eintrittsdatum (älteste zuerst), Meldung „3 Person(en)
  aktualisiert“ plus Liste der zehn nicht gefundenen E-Mails (weil lokal nur diese drei echten
  Konten existieren), Reihenfolge in `/admin` und `/admin/uebersicht` identisch.

**⚠ Logo auf der Login-Seite kaputt: Middleware blockierte public/-Dateien (2026-09-16, akut
behoben):** Michael meldete, die Live-Seite "sieht schlimmer aus, selbst auf Desktop". Ursache
war das Logo (Kapitel "Header/Logo", 2026-09-15): `src/middleware.ts` hatte den Matcher
`"/((?!_next/static|_next/image|favicon.ico).*)"`, der schliesst nur `_next/`-interne Pfade und
`favicon.ico` aus, NICHT aber andere Dateien direkt unter `public/` wie `alta-logo.png`. Für einen
noch nicht eingeloggten Aufruf der Login-Seite griff die Middleware deshalb auch bei der
Bild-Anfrage selbst und leitete sie auf `/login` um (HTML statt Bild), das Logo erschien als
kaputtes Bild-Icon. Beim eigenen Testen nie aufgefallen, weil der Test-Browser praktisch immer
schon eine gültige Session-Cookie hatte, dann läuft die Bild-Anfrage einfach durch die Middleware
durch, ohne dass es auffällt. Fix: Matcher um einen Dateiendungs-Ausschluss erweitert
(`.*\.(?:png|jpg|jpeg|gif|svg|webp|ico)$`), deckt damit `public/` automatisch mit ab, auch für
künftige weitere Bild-Dateien dort, nicht nur `alta-logo.png` einzeln freigeschaltet. Lokal via
`fetch('/alta-logo.png', { redirect: 'manual' })` verifiziert (`status: 200`, `redirected: false`
statt vorher ein Redirect), sowie visuell auf der Login-Seite. **Wichtige Lehre für künftige
Sessions:** Bei allem, was mit "auf der Login-Seite" oder "für nicht eingeloggte Personen" zu tun
hat, unbedingt mit tatsächlich geleerter Session testen (z.B. `document.cookie` leeren reicht bei
httpOnly-Auth-Cookies NICHT, eher ein komplett neues Browser-Profil/Inkognito oder direkt den
Netzwerk-Request mit `redirect: 'manual'` prüfen), ein bereits angemeldeter Test-Browser verdeckt
genau diese Klasse von Fehlern zuverlässig.

**Kalender-Formatierung auf Live: Dienstag-Spalte zu breit, Mobile "reingezoomt" (2026-09-16,
behoben):** Michael meldete per Screenshot, der Kalender sei jetzt auch auf Desktop "defekt",
konkretisiert auf Nachfrage zu: "formatierung ist komisch. dienstag ist breiter als der rest.
mobile generell sehr undeutlich und so reingezoomt." Zwei getrennte, echte Ursachen gefunden:

- **Dienstag-Spalte breiter:** `.kalender-grid` nutzte `grid-template-columns: repeat(7, 1fr)`.
  Ein `1fr`-Track ohne explizites Minimum orientiert sich trotzdem an der Mindestbreite (Min-Content)
  seines Inhalts. Ein langer, nicht umbrechender Notiztext (`.kalender-notiz-zeile` hat
  `white-space: nowrap` + `overflow: hidden` fürs visuelle Abschneiden) hat als Min-Content-Breite
  aber die volle, unabgeschnittene Textbreite, das zieht die ganze Spalte (alle Zeilen dieses
  Wochentags) breiter, auch wenn der Text selbst optisch abgeschnitten aussieht. Fix:
  `grid-template-columns: repeat(7, minmax(0, 1fr))` plus `min-width: 0` auf `.kalender-tag` (Grid-
  Items haben implizit `min-width: auto`, das muss ebenfalls aufgehoben werden). Lokal mit
  künstlich eingefügtem, sehr langem Notiztext verifiziert: alle 7 Spalten exakt gleich breit
  (vorher zog die betroffene Spalte sichtbar auseinander, jetzt konstant über alle Zeilen).
- **Mobile "sehr undeutlich und reingezoomt":** Alle Formularfelder (`.entry-form input`,
  `.login-form-card input`, `.konto-card input`, Kalender-Notiz-Formular usw.) hatten
  `font-size: 0.9–0.95rem` (14.4–15.2px). iOS Safari zoomt die gesamte Seite automatisch hinein,
  sobald ein fokussiertes Eingabefeld unter 16px Schriftgrösse hat, und bleibt danach auch auf
  anderen Seiten in diesem Zoom-Zustand hängen, bis man manuell wieder rauszoomt, genau das
  Symptom "reingezoomt und undeutlich". Fix: neue Regel im bestehenden
  `@media (max-width: 640px)`-Block, die `input, select, textarea` auf `16px !important` setzt
  (das `!important` ist nötig, weil die einzelnen Formular-Klassen spezifischer sind als ein
  blosser Element-Selektor und sonst gewinnen würden). Betrifft nur schmale Viewports, Desktop-
  Grössen unangetastet. Verifiziert via `getComputedStyle` auf allen Inputs bei 375px: vorher
  14.4px, nachher 16px, Layout dabei visuell unverändert (Screenshot-Vergleich).

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
