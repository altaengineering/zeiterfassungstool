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
      "RESEND_API_KEY nicht gesetzt — Krankmeldungs-E-Mail wurde nicht versendet (siehe CLAUDE.md).",
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
