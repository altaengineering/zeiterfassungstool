"use client";

import { nutzerLoeschen } from "./actions";

export function DeleteUserButton({ userId, name }: { userId: string; name: string }) {
  return (
    <form action={nutzerLoeschen}>
      <input type="hidden" name="userId" value={userId} />
      <button
        type="submit"
        className="link-btn-inline"
        onClick={(e) => {
          if (
            !confirm(
              `${name} wirklich löschen? Alle Zeiteinträge dieser Person gehen unwiderruflich verloren.`,
            )
          ) {
            e.preventDefault();
          }
        }}
      >
        löschen
      </button>
    </form>
  );
}
