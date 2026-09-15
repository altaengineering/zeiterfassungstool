import { prisma } from "@/lib/db";

// Übernimmt alte, frei getippte Buchungen (Booking.label) in die feste Projektliste: legt für
// jedes bisher unbekannte Label ein Project an und verknüpft alle passenden Buchungen per
// projectId. Idempotent, kann beliebig oft aufgerufen werden (z.B. erneut nach einem Seed-Lauf
// oder wenn doch nochmal jemand eine alte, unverknüpfte Buchung findet).
export async function migriereBuchungenZuProjekten(companyId: string): Promise<number> {
  const unverknuepft = await prisma.booking.findMany({
    where: { projectId: null, dailyEntry: { user: { companyId } } },
    select: { id: true, label: true },
  });

  let anzahlVerknuepft = 0;
  const projectIdByLabel = new Map<string, string>();

  for (const b of unverknuepft) {
    const name = b.label.trim();
    if (!name) continue;

    let projectId = projectIdByLabel.get(name);
    if (!projectId) {
      const project = await prisma.project.upsert({
        where: { companyId_name: { companyId, name } },
        update: {},
        create: { companyId, name },
      });
      projectId = project.id;
      projectIdByLabel.set(name, projectId);
    }

    await prisma.booking.update({ where: { id: b.id }, data: { projectId } });
    anzahlVerknuepft += 1;
  }

  return anzahlVerknuepft;
}
