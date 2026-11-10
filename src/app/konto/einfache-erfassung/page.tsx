import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { normalisiereStatus } from "@/lib/einfacheErfassung";
import { einfacheErfassungBeantragen, einfacheErfassungBeenden } from "./actions";

export const dynamic = "force-dynamic";

export default async function EinfacheErfassungSeite() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = (session.user as { id: string }).id;
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const status = normalisiereStatus(user.einfacheErfassung);
  const seit = user.einfacheErfassungSeit
    ? user.einfacheErfassungSeit.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" })
    : null;

  return (
    <main>
      <h1>Einfache Erfassung</h1>
      <p className="subtitle">
        Statt Kommen und Gehen zu stempeln und die Stunden auf Projekte zu verteilen, trägst du pro
        Tag nur noch deine Ist-Zeit ein, zum Beispiel 8 oder 7:30. Es gibt keinen Abgleich mit
        Stempelzeiten und keine Projektauswahl. Krank, Ferien, Reisezeit und Spesen bleiben gleich.
      </p>

      <div className="konto-card">
        <div className={"einfach-status einfach-status-" + status}>
          <span className="einfach-status-punkt" aria-hidden="true" />
          <div>
            <div className="einfach-status-titel">
              {status === "an" && "Einfache Erfassung ist eingeschaltet"}
              {status === "beantragt" && "Beantragt, wartet auf Freigabe durch den Chef"}
              {status === "aus" && "Ausgeschaltet: normale Erfassung mit Stempelzeiten und Projekten"}
            </div>
            {status === "an" && (
              <div className="form-hint">
                Freigegeben{user.einfacheErfassungVon ? ` von ${user.einfacheErfassungVon}` : ""}
                {seit ? ` am ${seit}` : ""}.
              </div>
            )}
            {status === "beantragt" && seit && <div className="form-hint">Beantragt am {seit}.</div>}
          </div>
        </div>

        {status === "aus" && (
          <form action={einfacheErfassungBeantragen} className="einfach-form">
            <label>
              Begründung für den Chef (optional)
              <input type="text" name="begruendung" maxLength={500} placeholder="z.B. arbeite nur noch an einem Projekt, Teilzeit im Aussendienst" />
            </label>
            <button type="submit">Beim Chef beantragen</button>
            <p className="form-hint">
              Eingeschaltet wird die einfache Erfassung nur mit Erlaubnis vom Chef. Er bekommt den
              Antrag in der Nutzerverwaltung angezeigt.
            </p>
          </form>
        )}

        {status === "beantragt" && (
          <form action={einfacheErfassungBeenden} className="einfach-form">
            <button type="submit" className="button-secondary">Antrag zurückziehen</button>
          </form>
        )}

        {status === "an" && (
          <form action={einfacheErfassungBeenden} className="einfach-form">
            <button type="submit" className="button-secondary">Zurück zur normalen Erfassung</button>
            <p className="form-hint">
              Danach gelten wieder Stempelzeiten und Projekte. Bereits eingetragene Tage bleiben
              unverändert. Für ein erneutes Einschalten braucht es wieder die Freigabe vom Chef.
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
