// Gemeinsame Hilfe fuer backup-db.mjs und restore-db.mjs.
//
// Das normale Prisma-Client-Paket in node_modules ist je nach letztem "prisma generate" auf SQLite
// (lokale Entwicklung) oder auf Postgres (Vercel-Build) festgelegt. Damit die Sicherung weder diesen
// Client noch die lokale Entwicklung stoert, erzeugt dieses Skript einen EIGENEN Client in
// scripts/.client aus dem Produktionsschema (prisma/schema.production.prisma). Das Schema wird nicht
// kopiert, sondern bei jedem Lauf frisch eingelesen und nur um die "output"-Zeile ergaenzt.

import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

// Abhaengigkeitsreihenfolge fuer das Einspielen (Eltern vor Kindern).
export const RESTORE_ORDER = [
  "Company", "User", "Project", "CompanySettings", "MonthClose", "Holiday",
  "JahresStammdaten", "PensumWechsel", "KalenderNotiz", "FerienAntrag", "DailyEntry", "Booking",
];

export async function loadClient(schemaRel = "prisma/schema.production.prisma") {
  const src = readFileSync(join(root, schemaRel), "utf8");
  const outDir = join(root, "scripts", ".client");
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(join(root, "scripts", ".tmp"), { recursive: true });
  const patched = src.replace(/generator client \{[^}]*\}/, 'generator client {\n  provider = "prisma-client-js"\n  output   = "../.client"\n}');
  const tmpSchema = join(root, "scripts", ".tmp", "schema.prisma");
  writeFileSync(tmpSchema, patched);
  const gen = spawnSync("npx", ["prisma", "generate", "--schema=" + tmpSchema], { cwd: root, stdio: "pipe", shell: true, encoding: "utf8" });
  if (gen.status !== 0) {
    console.error(gen.stdout, gen.stderr);
    throw new Error("prisma generate fehlgeschlagen");
  }
  const mod = await import(pathToFileURL(join(outDir, "index.js")).href);
  return { PrismaClient: mod.PrismaClient, Prisma: mod.Prisma };
}

export function lowerFirst(s) { return s.charAt(0).toLowerCase() + s.slice(1); }
