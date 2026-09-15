import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { initialen } from "@/lib/colors";
import { notizHinzufuegen, notizLoeschen } from "./actions";

export const dynamic = "force-dynamic";

const MONATSNAMEN = [
  "Jan", "Feb", "Mar", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez",
] as const;
const WOCHENTAGE_KURZ = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

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
  const heuteIso = iso(heute);
  const jahr = Number(jahrParam) || heute.getUTCFullYear();
  const monat = Number(monatParam) || heute.getUTCMonth() + 1;

  const userId = (session.user as { id: string }).id;
  const ich = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const binAdmin = ich.role === "ADMIN";

  const monatStart = new Date(Date.UTC(jahr, monat - 1, 1));
  const monatEnde = new Date(Date.UTC(jahr, monat, 1));
  const letzterTagMonat = new Date(Date.UTC(jahr, monat, 0)).getUTCDate();
  const heuteUtcMitternacht = new Date(
    Date.UTC(heute.getUTCFullYear(), heute.getUTCMonth(), heute.getUTCDate()),
  );

  const [feiertageDb, entriesDb, notizenDb] = await Promise.all([
    prisma.holiday.findMany({
      where: { companyId: ich.companyId, date: { gte: monatStart, lt: monatEnde } },
    }),
    prisma.dailyEntry.findMany({
      where: {
        user: { companyId: ich.companyId },
        date: { gte: monatStart, lt: monatEnde },
        // Krank ist sensibler als Ferien: fuer normale Mitarbeitende werden vergangene Krank-Tage
        // aus Datenschutzgruenden gar nicht erst geladen, nur heute und Zukunft (siehe Filter unten
        // beim Aufbau der Chips). Admins sehen weiterhin den vollen Verlauf (z.B. fuer Lohn-/
        // Absenz-Fragen), daher hier ohne Datumsgrenze, wenn `binAdmin`.
        OR: [
          { ferien: { gt: 0 } },
          { krank: { gt: 0 }, ...(binAdmin ? {} : { date: { gte: heuteUtcMitternacht } }) },
        ],
      },
      include: { user: true },
      orderBy: { date: "asc" },
    }),
    // Öffentliche Notizen von allen in der Firma, private Notizen nur die eigenen (siehe
    // actions.ts, Datenbank-Constraint gibt es dafür nicht, der Filter hier ist die einzige Stelle,
    // die private Notizen anderer Personen ausschliesst).
    prisma.kalenderNotiz.findMany({
      where: {
        date: { gte: monatStart, lt: monatEnde },
        OR: [{ oeffentlich: true, user: { companyId: ich.companyId } }, { userId: ich.id }],
      },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const feiertageByDate = new Map(feiertageDb.map((f) => [iso(f.date), f]));
  const abwesendByDate = new Map<string, { name: string; art: "Ferien" | "Krank"; stunden: number }[]>();
  for (const e of entriesDb) {
    const datum = iso(e.date);
    const liste = abwesendByDate.get(datum) ?? [];
    if (e.ferien > 0) liste.push({ name: e.user.name, art: "Ferien", stunden: e.ferien });
    // Fuer Nicht-Admins sind vergangene Krank-Tage hier oben schon gar nicht erst aus der DB
    // geladen worden (siehe Query), dieser Check ist nur die zweite Absicherung direkt an der
    // Stelle, wo der Chip entsteht. Admins sehen Krank-Tage unabhaengig vom Datum.
    if (e.krank > 0 && (binAdmin || datum >= heuteIso)) {
      liste.push({ name: e.user.name, art: "Krank", stunden: e.krank });
    }
    abwesendByDate.set(datum, liste);
  }

  const notizenByDate = new Map<string, typeof notizenDb>();
  for (const n of notizenDb) {
    const datum = iso(n.date);
    const liste = notizenByDate.get(datum) ?? [];
    liste.push(n);
    notizenByDate.set(datum, liste);
  }
  const eigeneNotizenDiesenMonat = notizenDb
    .filter((n) => n.userId === ich.id)
    .sort((a, b) => iso(a.date).localeCompare(iso(b.date)));

  const vorMonat = monat === 1 ? { jahr: jahr - 1, monat: 12 } : { jahr, monat: monat - 1 };
  const naechMonat = monat === 12 ? { jahr: jahr + 1, monat: 1 } : { jahr, monat: monat + 1 };

  const ersterWochentag = new Date(Date.UTC(jahr, monat - 1, 1)).getUTCDay(); // 0=So
  const fuehrendeLeerzellen = (ersterWochentag + 6) % 7; // Woche beginnt Montag

  const tage = Array.from({ length: letzterTagMonat }, (_, i) => {
    const tag = i + 1;
    const datum = `${jahr}-${String(monat).padStart(2, "0")}-${String(tag).padStart(2, "0")}`;
    const wochentag = new Date(`${datum}T00:00:00Z`).getUTCDay();
    return {
      tag,
      datum,
      wochentag,
      feiertag: feiertageByDate.get(datum) ?? null,
      abwesend: abwesendByDate.get(datum) ?? [],
      notizen: notizenByDate.get(datum) ?? [],
    };
  });

  const monatMinDatum = `${jahr}-${String(monat).padStart(2, "0")}-01`;
  const monatMaxDatum = `${jahr}-${String(monat).padStart(2, "0")}-${String(letzterTagMonat).padStart(2, "0")}`;

  const feiertageDiesenMonat = tage.filter((t) => t.feiertag);

  return (
    <main>
      <h1>Kalender</h1>
      <p className="subtitle">
        Feiertage und wer in der Firma Ferien oder krank gemeldet ist, für alle einsehbar.
        {!binAdmin && " Krankheitstage sind hier nur ab heute sichtbar, nicht rückwirkend."}
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

      <div className="kalender-legende">
        <span className="kalender-legende-item">
          <span className="kalender-chip kalender-chip-ferien">AB</span> Ferien
        </span>
        <span className="kalender-legende-item">
          <span className="kalender-chip kalender-chip-krank">AB</span> Krank
        </span>
        <span className="kalender-legende-item">
          <span className="kalender-tag-swatch kalender-tag-feiertag" /> Feiertag
        </span>
        <span className="kalender-legende-item">
          <span className="kalender-tag-swatch kalender-tag-wochenende" /> Wochenende
        </span>
      </div>

      <div className="kalender-grid">
        {WOCHENTAGE_KURZ.map((w) => (
          <div key={w} className="kalender-kopf">
            {w}
          </div>
        ))}
        {Array.from({ length: fuehrendeLeerzellen }, (_, i) => (
          <div key={`leer-${i}`} className="kalender-tag kalender-tag-leer" />
        ))}
        {tage.map((t) => {
          const istWochenende = t.wochentag === 0 || t.wochentag === 6;
          const istHeute = t.datum === heuteIso;
          const klassen = [
            "kalender-tag",
            t.feiertag ? "kalender-tag-feiertag" : istWochenende ? "kalender-tag-wochenende" : "",
            istHeute ? "kalender-tag-heute" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <div key={t.datum} className={klassen}>
              <span className="kalender-tag-nummer">{t.tag}</span>
              {t.feiertag && <span className="kalender-tag-label">{t.feiertag.label.trim()}</span>}
              {t.abwesend.length > 0 && (
                <div className="kalender-chips">
                  {t.abwesend.map((a, i) => (
                    <span
                      key={i}
                      className={"kalender-chip " + (a.art === "Ferien" ? "kalender-chip-ferien" : "kalender-chip-krank")}
                      title={`${a.name}, ${a.art}, ${formatStunden(a.stunden)}h`}
                    >
                      {initialen(a.name)}
                    </span>
                  ))}
                </div>
              )}
              {t.notizen.length > 0 && (
                <div className="kalender-notizen">
                  {t.notizen.map((n) => (
                    <span
                      key={n.id}
                      className="kalender-notiz-zeile"
                      title={`${n.oeffentlich ? "Öffentlich" : "Privat"}, ${n.user.name}: ${n.text}`}
                    >
                      {n.oeffentlich ? "🌐" : "🔒"} {n.user.name.split(" ")[0]}: {n.text}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {feiertageDiesenMonat.length > 0 && (
        <div className="kalender-feiertagsliste">
          {feiertageDiesenMonat.map((t) => (
            <span key={t.datum} className="kalender-feiertagsliste-item">
              {t.tag}. {MONATSNAMEN[monat - 1]}: {t.feiertag?.label.trim()}
            </span>
          ))}
        </div>
      )}

      <div className="entry-form-card" style={{ marginTop: 24 }}>
        <div className="form-section-title">Notiz hinzufügen</div>
        <p className="form-hint">
          Privat sieht nur du selbst, öffentlich sehen alle in der Firma (z.B. „Homeoffice“ oder
          „im Kundentermin“).
        </p>
        <form action={notizHinzufuegen} className="entry-form">
          <div className="form-row-pair">
            <label>
              Datum
              <input
                type="date"
                name="datum"
                defaultValue={heuteIso >= monatMinDatum && heuteIso <= monatMaxDatum ? heuteIso : monatMinDatum}
                min={monatMinDatum}
                max={monatMaxDatum}
                required
              />
            </label>
            <label>
              Text
              <input type="text" name="text" placeholder="z.B. Homeoffice" required />
            </label>
          </div>
          <div className="pill-group">
            <input type="radio" id="notiz-privat" name="sichtbarkeit" value="privat" defaultChecked />
            <label htmlFor="notiz-privat">🔒 Privat</label>
            <input type="radio" id="notiz-oeffentlich" name="sichtbarkeit" value="oeffentlich" />
            <label htmlFor="notiz-oeffentlich">🌐 Öffentlich</label>
          </div>
          <div className="entry-form-footer">
            <button type="submit">Notiz speichern</button>
          </div>
        </form>
      </div>

      {eigeneNotizenDiesenMonat.length > 0 && (
        <div className="table-wrap" style={{ marginTop: 24 }}>
          <table>
            <thead>
              <tr>
                <th>Datum</th>
                <th className="label-cell">Notiz</th>
                <th className="label-cell">Sichtbarkeit</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {eigeneNotizenDiesenMonat.map((n) => (
                <tr key={n.id}>
                  <td>
                    {iso(n.date).slice(8, 10)}.{iso(n.date).slice(5, 7)}.
                  </td>
                  <td className="label-cell">{n.text}</td>
                  <td className="label-cell">{n.oeffentlich ? "🌐 Öffentlich" : "🔒 Privat"}</td>
                  <td className="label-cell">
                    <form action={notizLoeschen}>
                      <input type="hidden" name="id" value={n.id} />
                      <button type="submit" className="link-btn-inline">
                        löschen
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
