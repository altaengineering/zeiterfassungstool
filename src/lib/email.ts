import { Resend } from "resend";

// E-Mail-Versand ist optional: ohne RESEND_API_KEY (z.B. lokal ohne Konfiguration) wird nur eine
// Konsolen-Warnung ausgegeben, das Speichern eines Tageseintrags darf davon nie abhängen.
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

function formatDatum(datumIso: string): string {
  const [jahr, monat, tag] = datumIso.split("-");
  return `${tag}.${monat}.${jahr}`;
}

export async function sendeKrankmeldung(params: {
  mitarbeiterName: string;
  datumIso: string;
  empfaengerEmails: string[];
}) {
  if (params.empfaengerEmails.length === 0) return;

  if (!resend) {
    console.warn(
      "RESEND_API_KEY nicht gesetzt — Krankmeldungs-E-Mail wurde nicht versendet (siehe PROJEKTSTAND.md).",
    );
    return;
  }

  const datum = formatDatum(params.datumIso);
  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev",
      to: params.empfaengerEmails,
      subject: `Krankmeldung: ${params.mitarbeiterName} – ${datum}`,
      text: `${params.mitarbeiterName} hat sich in der Zeiterfassung für den ${datum} krank gemeldet.`,
    });
  } catch (e) {
    // Ein fehlgeschlagener E-Mail-Versand darf den Tageseintrag nie ungespeichert lassen.
    console.error("Krankmeldungs-E-Mail konnte nicht gesendet werden:", e);
  }
}

export async function sendeErinnerung(params: {
  mitarbeiterName: string;
  empfaengerEmail: string;
  datumIso: string;
}) {
  if (!resend) {
    console.warn(
      "RESEND_API_KEY nicht gesetzt, Erinnerungs-E-Mail wurde nicht versendet (siehe PROJEKTSTAND.md).",
    );
    return;
  }

  const datum = formatDatum(params.datumIso);
  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev",
      to: [params.empfaengerEmail],
      subject: `Zeiterfassung: noch kein Eintrag für ${datum}`,
      text:
        `Hallo ${params.mitarbeiterName}\n\n` +
        `Für den ${datum} ist in der Zeiterfassung noch kein Eintrag vorhanden. ` +
        `Falls das ein Versehen war, einfach nachtragen: https://zeiterfassungstool-psi.vercel.app\n\n` +
        `Diese Erinnerung kommt automatisch, du musst nicht antworten.`,
    });
  } catch (e) {
    console.error("Erinnerungs-E-Mail konnte nicht gesendet werden:", e);
  }
}

// Antrag auf einfache Erfassung (nur Ist-Zeit), siehe src/lib/einfacheErfassung.ts
export async function sendeAntragEinfacheErfassung(params: {
  mitarbeiterName: string;
  empfaengerEmails: string[];
  begruendung: string;
}) {
  if (params.empfaengerEmails.length === 0) return;
  if (!resend) {
    console.warn("RESEND_API_KEY nicht gesetzt, Antrag auf einfache Erfassung wurde nicht per E-Mail gemeldet.");
    return;
  }
  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev",
      to: params.empfaengerEmails,
      subject: `Zeiterfassung: ${params.mitarbeiterName} beantragt die einfache Erfassung`,
      text:
        `${params.mitarbeiterName} möchte die Arbeitszeit nur noch als Ist-Zeit pro Tag eintragen ` +
        `(ohne Stempelzeiten und ohne Projekte).\n\n` +
        (params.begruendung ? `Begründung: ${params.begruendung}\n\n` : "") +
        `Freigeben oder ablehnen in der Zeiterfassung unter Admin, Nutzerverwaltung.`,
    });
  } catch (e) {
    console.error("Antrag auf einfache Erfassung konnte nicht per E-Mail gemeldet werden:", e);
  }
}
