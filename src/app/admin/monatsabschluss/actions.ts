"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

async function firmaDesAdmins() {
  const session = await auth();
  const rolle = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || rolle !== "ADMIN") throw new Error("Nicht autorisiert");
  const userId = (session.user as { id: string }).id;
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return user.companyId;
}

export async function monatAbschliessen(formData: FormData) {
  const companyId = await firmaDesAdmins();
  const year = Number(formData.get("year"));
  const month = Number(formData.get("month"));

  await prisma.monthClose.upsert({
    where: { companyId_year_month: { companyId, year, month } },
    update: {},
    create: { companyId, year, month },
  });

  revalidatePath("/admin/monatsabschluss");
}

export async function monatOeffnen(formData: FormData) {
  const companyId = await firmaDesAdmins();
  const year = Number(formData.get("year"));
  const month = Number(formData.get("month"));

  await prisma.monthClose.deleteMany({ where: { companyId, year, month } });

  revalidatePath("/admin/monatsabschluss");
}
