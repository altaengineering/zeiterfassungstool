#!/usr/bin/env node
// Spielt eine Sicherung von backup-db.mjs in eine LEERE Datenbank ein.
//
//   node --env-file=.env.production.local scripts/restore-db.mjs backups/zft-db-....json.gz
//
// Voraussetzung: Die Tabellen existieren (bei einer neuen Datenbank zuerst
//   npx prisma db push --schema=prisma/schema.production.prisma
// ausfuehren). Das Skript bricht ab, wenn bereits Benutzer in der Datenbank sind. Mit --force wird
// trotzdem eingespielt; bestehende Zeilen mit gleicher ID fuehren dann zu einem Fehler, nichts wird
// stillschweigend ueberschrieben.
//
// Wichtig: Wiederherstellen ueberschreibt auf dem Live-System den laufenden Betrieb. Vorher mit einer
// Kopie der Datenbank ueben (siehe Betriebsanleitung, Kapitel Wiederherstellung).
//
// Optionen:  --schema <pfad>   wie bei backup-db.mjs
//            --force           auch in eine nicht leere Datenbank einspielen

import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { loadClient, lowerFirst, RESTORE_ORDER } from "./lib/client.mjs";

const args = process.argv.slice(2);
const file = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--schema");
const opt = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : dflt; };
const schema = opt("--schema", "prisma/schema.production.prisma");
const force = args.includes("--force");

if (!file) { console.error("Aufruf: node --env-file=... scripts/restore-db.mjs <sicherung.json.gz>"); process.exit(1); }
if (!process.env.DATABASE_URL) { console.error("DATABASE_URL fehlt."); process.exit(1); }

const raw = readFileSync(file);
let text;
try { text = gunzipSync(raw).toString("utf8"); } catch { text = raw.toString("utf8"); }
const data = JSON.parse(text);
if (data.format !== "zft-db-backup") { console.error("Keine Sicherungsdatei des Zeiterfassungstools."); process.exit(1); }

const { PrismaClient, Prisma } = await loadClient(schema);
const prisma = new PrismaClient();
try {
  const dm = Prisma.dmmf.datamodel.models;
  const known = new Set(dm.map((m) => m.name));
  const missing = RESTORE_ORDER.filter((n) => !known.has(n));
  const extra = [...known].filter((n) => !RESTORE_ORDER.includes(n));
  if (missing.length || extra.length) {
    throw new Error("Das Schema passt nicht zur festen Einspielreihenfolge. Fehlend: " + missing.join(",") + " Neu: " + extra.join(",") + ". RESTORE_ORDER in scripts/lib/client.mjs anpassen.");
  }
  const existing = await prisma.user.count();
  if (existing > 0 && !force) {
    throw new Error(`Die Datenbank enthaelt schon ${existing} Benutzer. Abbruch (mit --force trotzdem einspielen).`);
  }
  console.log("Sicherung vom", data.createdAt);
  for (const name of RESTORE_ORDER) {
    const rows = data.tables[name] || [];
    if (!rows.length) { console.log("  " + name.padEnd(18), 0); continue; }
    const model = dm.find((m) => m.name === name);
    const dateFields = model.fields.filter((f) => f.type === "DateTime").map((f) => f.name);
    const fixed = rows.map((r) => {
      const o = { ...r };
      for (const f of dateFields) if (o[f] != null) o[f] = new Date(o[f]);
      return o;
    });
    // In Bloecken einspielen, damit grosse Tabellen (Tageseintraege) nicht an Parameterlimits scheitern.
    for (let i = 0; i < fixed.length; i += 500) {
      await prisma[lowerFirst(name)].createMany({ data: fixed.slice(i, i + 500) });
    }
    console.log("  " + name.padEnd(18), rows.length);
  }
  console.log("Fertig.");
} finally {
  await prisma.$disconnect();
}
