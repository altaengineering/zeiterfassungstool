"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

export function TagesZeile({
  userId,
  jahr,
  monat,
  datum,
  className,
  children,
}: {
  userId: string;
  jahr: number;
  monat: number;
  datum: string;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();

  return (
    <tr
      className={`zeile-klickbar ${className ?? ""}`.trim()}
      onClick={() => router.push(`/mitarbeiter/${userId}/${jahr}/${monat}?tag=${datum}#tageseintrag-formular`)}
    >
      {children}
    </tr>
  );
}
