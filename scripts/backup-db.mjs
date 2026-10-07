#!/usr/bin/env node
// Sichert die komplette Datenbank des Zeiterfassungstools in eine JSON-Datei (gzip).
//
//   Zugangsdaten holen (einmalig, danach bei Bedarf erneuern):
//     npx vercel link                                   (Projekt zuordnen, falls noch nicht geschehen)
//     npx vercel env pull .env.production.local --environment=production
//   Sicherung ausfuehren:
//     node --env-file=.env.production.local scripts/backup-db.mjs
//
// Ergebnis: backups/zft-db-<Zeitstempel>.json.gz im Projektordner (Ordner ist von Git ausgeschlossen).
// ACHTUNG: Die Datei enthaelt alle Zeitdaten und die Passwort-Hashes der Mitarbeitenden. Nur auf
// verschluesselten Datentraegern oder in der internen Ablage aufbewahren, nie per Mail verschicken
// und nie in ein Repository legen.
//
// Optionen:  --schema <pfad>   anderes Prisma-Schema verwenden (z.B. prisma/schema.prisma fuer die lokale
//                              SQLite-Entwicklungsdatenbank, dann mit DATABASE_URL=file:./dev.db)
//            --out <ordner>    Zielordner (Standard: backups)

import { writeFileSync, mkdirSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join, resolve } from "node:path";
import { loadClient, lowerFirst } from "./lib/client.mjs";

const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : dflt; };
const schema = opt("--schema", "prisma/schema.production.prisma");
const outDir = resolve(opt("--out", "backups"));

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL fehlt. Siehe Kopf dieser Datei: erst 'vercel env pull', dann mit --env-file starten.");
  process.exit(1);
}

const { PrismaClient, Prisma } = await loadClient(schema);
const prisma = new PrismaClient();
try {
  const models = Prisma.dmmf.datamodel.models.map((m) => m.name);
  const tables = {};
  const counts = {};
  for (const name of models) {
    tables[name] = await prisma[lowerFirst(name)].findMany();
    counts[name] = tables[name].length;
  }
  const data = { format: "zft-db-backup", version: 1, createdAt: new Date().toISOString(), schema, tables };
  mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 13).replace("T", "-");
  const file = join(outDir, `zft-db-${stamp}.json.gz`);
  const gz = gzipSync(Buffer.from(JSON.stringify(data)));
  writeFileSync(file, gz);
  console.log("Gesichert:", file, `(${Math.round(gz.length / 1024)} KB)`);
  for (const n of models) console.log("  " + n.padEnd(18), counts[n]);
} finally {
  await prisma.$disconnect();
}
