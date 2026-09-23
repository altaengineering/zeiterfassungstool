"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { ferienAntragEntscheiden } from "@/lib/ferienAntrag";

async function pruefeAdmin(): Promise<string> {
  const session = await auth();
  const rolle = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || rolle !== "ADMIN") {
    throw new Error("Nicht autorisiert");
  }
  return session.user.email ?? "";
}

export async function ferienAntragGenehmigen(formData: FormData) {
  const adminEmail = await pruefeAdmin();
  const antragId = String(formData.get("antragId") ?? "");
  if (!antragId) return;

  await ferienAntragEntscheiden(antragId, "genehmigt", adminEmail);

  revalidatePath("/admin/uebersicht");
  revalidatePath("/ferien");
  revalidatePath("/kalender");
}

export async function ferienAntragAblehnen(formData: FormData) {
  const adminEmail = await pruefeAdmin();
  const antragId = String(formData.get("antragId") ?? "");
  if (!antragId) return;

  await ferienAntragEntscheiden(antragId, "abgelehnt", adminEmail);

  revalidatePath("/admin/uebersicht");
  revalidatePath("/ferien");
}
