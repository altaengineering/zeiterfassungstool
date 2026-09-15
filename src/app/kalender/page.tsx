import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const MONATSNAMEN = [
  "Jan", "Feb", "Mar", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez",
] as const;
const WOCHENTAGE = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatStunden(h: number): string {
  return h.toFixed(2).replace(/\.00$/, "");
}

type Props = {
  searchParams: Promise<{ jahr?: string; monat?: string }>;
};

export default async function KalenderSeite({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { jahr: jahrParam, monat: monatParam } = await searchParams;
  const heute = new Date();
  const jahr = Number(jahrParam) || heute.getUTCFullYear();
  const monat = Number(monatParam) || heute.getUTCMonth() + 1;

  const userId = (session.user as { id: string }).id;
  const ich = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  const monatStart = new Date(Date.UTC(jahr, monat - 1, 1));
  const monatEnde = new Date(Date.UTC(jahr, monat, 1));
  const letzterTagMonat = new Date(Date.UTC(jahr, monat, 0)).getUTCDate();

  const [feiertageDb, entriesDb] = await Promise.all([
    prisma.holiday.findMany({
      where: { companyId: ich.companyId, date: { gte: monatStart, lt: monatEnde } },
    }),
    prisma.dailyEntry.findMany({
      where: {
        user: { companyId: ich.companyId },
        date: { gte: monatStart, lt: monatEnde },
        OR: [{ ferien: { gt: 0 } }, { krank: { gt: 0 } }],
      },
      include: { user: true },
      orderBy: { date: "asc" },
    }),
  ]);

  const feiertageByDate = new Map(feiertageDb.map((f) => [iso(f.date), f]));
  const abwesendByDate = new Map<string, { name: string; art: string; stunden: number }[]>();
  for (const e of entriesDb) {
    const datum = iso(e.date);
    const liste = abwesendByDate.get(datum) ?? [];
    if (e.ferien > 0) liste.push({ name: e.user.name, art: "Ferien", stunden: e.ferien });
    if (e.krank > 0) liste.push({ name: e.user.name, art: "Krank", stunden: e.krank });
    abwesendByDate.set(datum, liste);
  }

  const vorMonat = monat === 1 ? { jahr: jahr - 1, monat: 12 } : { jahr, monat: monat - 1 };
  const naechMonat = monat === 12 ? { jahr: jahr + 1, monat: 1 } : { jahr, monat: monat + 1 };

  const tage = Array.from({ length: letzterTagMonat }, (_, i) => {
    const tag = i + 1;
    const datum = `${jahr}-${String(monat).padStart(2, "0")}-${String(tag).padStart(2, "0")}`;
    const wochentag = new Date(`${datum}T00:00:00Z`).getUTCDay();
    return {
      datum,
      wochentag,
      feiertag: feiertageByDate.get(datum) ?? null,
      abwesend: abwesendByDate.get(datum) ?? [],
    };
  });

  return (
    <main>
      <h1>Kalender</h1>
      <p className="subtitle">
        Feiertage und wer in der Firma Ferien oder krank gemeldet ist, für alle einsehbar.
      </p>

      <div className="month-nav">
        <Link href={`/kalender?jahr=${vorMonat.jahr}&monat=${vorMonat.monat}`}>
          ← {MONATSNAMEN[vorMonat.monat - 1]} {vorMonat.jahr}
        </Link>
        <span className="current">
          {MONATSNAMEN[monat - 1]} {jahr}
        </span>
        <Link href={`/kalender?jahr=${naechMonat.jahr}&monat=${naechMonat.monat}`}>
          {MONATSNAMEN[naechMonat.monat - 1]} {naechMonat.jahr} →
        </Link>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Datum</th>
              <th className="label-cell">Feiertag</th>
              <th className="label-cell">Abwesend</th>
            </tr>
          </thead>
          <tbody>
            {tage.map((t) => {
              const istWochenende = t.wochentag === 0 || t.wochentag === 6;
              const rowClass = t.feiertag ? "holiday" : istWochenende ? "weekend" : "";
              return (
                <tr key={t.datum} className={rowClass}>
                  <td>
                    {WOCHENTAGE[t.wochentag]?.slice(0, 2)}, {t.datum.slice(8, 10)}.{t.datum.slice(5, 7)}.
                  </td>
                  <td className="label-cell">{t.feiertag?.label.trim() ?? "—"}</td>
                  <td className="label-cell">
                    {t.abwesend.length > 0
                      ? t.abwesend.map((a) => `${a.name} (${a.art}, ${formatStunden(a.stunden)}h)`).join(", ")
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
