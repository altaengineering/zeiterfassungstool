# Zeiterfassungstool – Spezifikation
Extrahiert aus `Arbeitsrapport_2026_kum.xlsx` (Alta Engineering AG, Vorlage für 15 Mitarbeitende)

## 1. Ziel
Web-App mit Login pro Mitarbeitendem (15 Nutzer), die die komplette Logik des bestehenden
Excel-Arbeitsrapports abbildet. Kein täglicher manueller Upload mehr – Daten werden direkt
online erfasst und gespeichert. Stefan (Admin/Vorgesetzter) kann jederzeit einen Excel-Export
im Originalformat ziehen.

## 2. Datenmodell

### Mitarbeitende (User)
- Name
- Firma (aktuell: Alta Engineering AG)
- Anstellung % (z.B. 1.0 = 100%)
- Arbeitsstunden pro Woche (z.B. 42)
- Rolle: Mitarbeiter / Admin (Stefan)

### Jahres-Stammdaten pro Mitarbeitendem (entspricht Blatt "Summen")
| Feld | Formel/Bedeutung |
|---|---|
| Arbeitszeit pro Tag (Soll) | `Wochenstunden / 5 * Anstellungsgrad` |
| Anzahl Vorholtage | manueller Wert |
| Vorholzeit pro Tag | `Soll-Jahresarbeitszeit(mit Ferien,mit Vorholtage) / Arbeitstage - Soll pro Tag` |
| Stundenübertrag altes Jahr | manueller Startwert, trägt sich automatisch fort |
| Ferienübertrag altes Jahr | manueller Startwert |
| Jahresferientage neu | `6.5/12 * 20 - 0.00333333` (Formel aus Vorlage, ggf. Konstante prüfen) |
| Ferien Guthaben | `ROUND(Ferienübertrag + Arbeitsmonate/12 * Jahresferientage_neu, 1)` |
| Ferien bezogen im Jahr | Summe der "Ferien"-Spalte über alle Monate + evtl. Rest-Tag im Dezember |
| Ferienübertrag nächstes Jahr | `Ferien Guthaben - Ferien bezogen` |
| Kilometer-Spesensatz | z.B. CHF 0.70/km (konfigurierbar) |

### Feiertage (pro Kanton/Firma konfigurierbar, jahresabhängig)
Liste: Datum, Bezeichnung, bezahlt (ja/nein). Beispiel 2026 (Alta Engineering, vermutlich LU/Kanton-spezifisch):
Neujahr, Josefstag, Karfreitag, Ostermontag, Auffahrt, Pfingstmontag, Fronleichnam,
Nationalfeiertag, Maria Himmelfahrt, Justustag, Allerheiligen, Maria Empfängnis,
Weihnachtstag, Stephanstag.
→ **Muss pro Firma/Jahr editierbar sein**, nicht hardcoded.

### Tageseintrag (Kernentität – ein Datensatz pro Mitarbeitendem pro Tag)
| Feld | Typ | Herkunft im Excel |
|---|---|---|
| Datum | Date | Spalte A |
| Projekt-Stunden (mehrere Spalten, dynamisch benannt) | Number je Projekt | Spalten C–K (Projektnamen sind frei benennbar, z.B. "Alta Engineering", "Pfisterer AG") |
| krank | Number (h) | Spalte L |
| Reisezeit | Number (h) | Spalte M |
| CAD | Number (h) | Spalte N |
| Ausbildung | Number (h) | Spalte O |
| Büro | Number (h) | Spalte P |
| Ferien | Number (h) | Spalte Q |
| Spesen (Fr.) | Number (CHF) | Spalte V |
| Km | Number | Spalte W |
| Start/Stop 1–4 | Time je Feld (8 Felder) | Spalten Y–AF, bis zu 4 Zeitblöcke pro Tag |

**Wichtig:** Die Projekt-Spalten sind in der Vorlage **pro Monat unterschiedlich** (z.B. Jan: nur
"Alta Engineering", Feb: "Pfisterer AG" + "Alta Eng."). Das Tool muss projektbasierte Buchung
unterstützen, nicht fixe Spalten – am besten: Projekt als eigene Entität, Stunden pro
Tag+Projekt als eigene Zeile/Buchung.

## 3. Berechnungslogik (pro Tag)

```
Soll[Tag] =
  0,                                          wenn Wochenende
  0,                                          wenn Feiertag mit "bezahlt = ja"
  Soll-Zeit-pro-Tag (aus Stammdaten)          sonst

Ist[Tag] = Summe aller Stunden-Spalten (Projekte + krank + Reisezeit + CAD + Ausbildung + Büro + Ferien)

+/-[Tag] = Ist[Tag] - Soll[Tag]

Stand[Tag] = Stand[Vortag] + (+/-[Tag])   // rollierender Saldo, läuft über Monatsgrenzen hinweg
                                            // Startwert Jan 1: Stundenübertrag aus Vorjahr

Ist-Zeit aus Stempelzeiten[Tag] =
  (Stop1-Start1) + (Stop2-Start2) + (Stop3-Start3) + (Stop4-Start4)
  → als hh:mm, hh, .hh (Dezimalminuten) und h.h (Dezimalstunden) darstellen

Aufteilung-Istzeit[Tag] = Summe(Projekt-/Kategorie-Stunden) - Ist-Zeit-aus-Stempelzeiten
  // Kontrollspalte: sollte 0 sein, zeigt Abweichung zwischen manuell gebuchten
  // Kategorie-Stunden und den effektiv gestempelten Zeiten
```

**Wochenende-Erkennung:** `WEEKDAY(Datum) in {6,7}` (Samstag/Sonntag)
**Feiertag-Erkennung:** Lookup in Feiertagsliste; wenn `bezahlt = "ja"` → Soll = 0, Tag zählt trotzdem als "frei" ohne Minusstunden. Wenn `bezahlt = "nein"` → Tag ist frei, aber ohne Soll-Reduktion-Effekt auf Saldo prüfen (im Original: Soll wird bei jedem erkannten Feiertag auf 0 gesetzt, unabhängig von bezahlt/unbezahlt – nur zur Anzeige wird zwischen ja/nein unterschieden).

## 4. Monats- und Jahresebene (entspricht "Summen"-Blatt)

- Summe je Kategorie-Spalte über den Monat (Total-Zeile)
- Stand am Monatsende = Ausgangswert für Folgemonat
- Jahres-Soll-Arbeitszeit (mit/ohne Ferienabzug, mit/ohne Vorholtage) – 3 Varianten wie im Original
- Spesen-Übersicht pro Monat (CHF + Km + Gesamt)
- Ferien-Übersicht: Guthaben, bezogen, Übertrag nächstes Jahr

## 5. Rollen & Rechte

- **Mitarbeitende:** eigene Tageseinträge erfassen/bearbeiten, eigene Monats-/Jahresübersicht sehen
- **Stefan (Admin):** alle 15 Mitarbeitenden einsehen, Feiertagsliste & Firmenstammdaten pflegen, Excel-Export für einzelne oder alle Mitarbeitende ziehen

## 6. Excel-Export

Muss das Originalformat 1:1 reproduzieren können:
- 12 Monatsblätter + Summen-Blatt + Feiertage-Blatt
- Gleiche Spaltenreihenfolge, gleiche Formeln (nicht nur Werte) – falls Stefan die Datei
  weiterverwendet/prüft, sollten Formeln nachvollziehbar bleiben
- Kopfbereich pro Monatsblatt: Firmenname, Name, Monat, Anstellung %, Blatt-Nr., Ferien-Übersicht,
  Stundenübertrag Vormonat

## 7. Offene Punkte für die Umsetzung (technisch, nicht mehr aus Excel ableitbar)

- Datenbank-Schema (User, DailyEntry, Project, Holiday, CompanySettings)
- Authentifizierung (z.B. E-Mail/Passwort, oder SSO)
- Hosting (Schweiz empfehlenswert wegen Personaldaten/DSG)
- Excel-Export-Engine (z.B. via openpyxl/exceljs, Formeln statt nur Werte schreiben)
- Mobile-Tauglichkeit (Stempelzeiten unterwegs erfassen)

## 8. Empfehlung für die Umsetzung

Dieses Dokument als Ausgangsspezifikation in **Claude Code** verwenden, um das Projekt
(Backend + Datenbank + Frontend + Excel-Export) strukturiert aufzusetzen. Die Formellogik oben
ist die verbindliche Referenz – bei Unklarheiten im Original-Excel nachschlagen
(`Arbeitsrapport_2026_kum.xlsx`, Blätter `Summen` und `Feiertage`).
