import { prisma } from "@/lib/db";

// Übernimmt alte, frei getippte oder firmenweite Buchungen (Booking.label bzw. ein noch nicht
// beanspruchtes Project) in die eigene, persönliche Projektliste einer Person: legt für jeden
// bisher unbekannten Text ein eigenes Project an (oder übernimmt ein bestehendes, noch niemandem
// gehörendes Project mit demselben Namen direkt statt es zu duplizieren) und verknüpft alle
// passenden Buchungen dieser Person per projectId. Idempotent, kann beliebig oft aufgerufen werden.
export async function migriereEigeneBuchungenZuProjekten(userId: string): Promise<number> {
  const offeneBuchungen = await prisma.booking.findMany({
    where: {
      dailyEntry: { userId },
      OR: [{ projectId: null }, { project: { userId: null } }],
    },
    include: { project: true },
  });

  let anzahlVerknuepft = 0;
  const projectIdByName = new Map<string, string>();

  for (const b of offeneBuchungen) {
    const name = (b.project?.name ?? b.label).trim();
    if (!name) continue;

    let projectId = projectIdByName.get(name);
    if (!projectId) {
      if (b.project && b.project.userId === null) {
        // Herrenloses Project mit passendem Namen (aus der Zeit vor der persönlichen Liste, oder
        // noch von niemandem beansprucht): direkt übernehmen statt ein Duplikat anzulegen.
        const uebernommen = await prisma.project.update({
          where: { id: b.project.id },
          data: { userId },
        });
        projectId = uebernommen.id;
      } else {
        const project = await prisma.project.upsert({
          where: { userId_name: { userId, name } },
          update: {},
          create: { userId, name },
        });
        projectId = project.id;
      }
      projectIdByName.set(name, projectId);
    }

    if (b.projectId !== projectId) {
      await prisma.booking.update({ where: { id: b.id }, data: { projectId } });
      anzahlVerknuepft += 1;
    }
  }

  return anzahlVerknuepft;
}
