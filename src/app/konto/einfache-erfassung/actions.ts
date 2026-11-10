"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { sendeAntragEinfacheErfassung } from "@/lib/email";
import { normalisiereStatus } from "@/lib/einfacheErfassung";

// Mitarbeitende koennen die einfache Erfassung nur BEANTRAGEN. Eingeschaltet wird sie ausschliesslich
// von einem Admin (src/app/admin/actions.ts, einfacheErfassungSetzen). Ausschalten bzw. den Antrag
// zurueckziehen darf die Person selbst, das fuehrt zurueck zu den normalen Regeln.

async function eigeneId(): Promise<string> {
  const session = await auth();
  const id = (session?.user as { id?: string } | undefined)?.id;
  if (!id) throw new Error("Nicht angemeldet.");
  return id;
}

function neuLaden() {
  revalidatePath("/konto/einfache-erfassung");
  revalidatePath("/admin");
  revalidatePath("/", "layout");
}

export async function einfacheErfassungBeantragen(formData: FormData) {
  const userId = await eigeneId();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (normalisiereStatus(user.einfacheErfassung) !== "aus") return;
  const begruendung = String(formData.get("begruendung") ?? "").trim().slice(0, 500);
  await prisma.user.update({
    where: { id: userId },
    data: { einfacheErfassung: "beantragt", einfacheErfassungSeit: new Date(), einfacheErfassungVon: null },
  });
  const admins = await prisma.user.findMany({
    where: { companyId: user.companyId, role: "ADMIN", id: { not: userId } },
    select: { email: true },
  });
  await sendeAntragEinfacheErfassung({
    mitarbeiterName: user.name,
    empfaengerEmails: admins.map((a) => a.email),
    begruendung,
  });
  neuLaden();
}

// Antrag zurueckziehen oder einfache Erfassung beenden (zurueck zur normalen Erfassung)
export async function einfacheErfassungBeenden() {
  const userId = await eigeneId();
  await prisma.user.update({
    where: { id: userId },
    data: { einfacheErfassung: "aus", einfacheErfassungSeit: new Date(), einfacheErfassungVon: null },
  });
  neuLaden();
}
