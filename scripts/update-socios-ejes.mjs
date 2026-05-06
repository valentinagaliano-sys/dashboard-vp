/**
 * Actualiza solo la columna `Eje` de la pestaña KPIs_PYMEs según el mapping
 * canónico, preservando Meta 2026 + columnas mensuales + segmentos/notas/etc.
 *
 * Uso: node scripts/update-socios-ejes.mjs
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { google } from "googleapis";

const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
for (const line of raw.split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  let [, k, v] = m;
  if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
  if (!(k in process.env)) process.env[k] = v;
}

const auth = new google.auth.JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });
const spreadsheetId = process.env.SHEET_ID;
const TAB = "KPIs_PYMEs";

// Mapping canónico: (socio, solución) → eje.
const MAP = new Map(
  [
    ["BCI||Cuenta Digital", "Capital"],
    ["BCI||Modelo Nace Emprendimiento", "Capital"],
    ["Walmart||Marketplace", "Mercado"],
    ["Blue Express||Cupón descuento despacho", "Mercado"],
    ["Defontana||Contabilidad Gratuita / ERP", "Digitalización"],
    ["Defontana||Defontana Digital", "Digitalización"],
    ["Microsoft||Elevate", "Gestión y Talento"],
    ["Microsoft||Agente Copilot", "Gestión y Talento"],
    ["Microsoft||Ciberseguridad", "Gestión y Talento"],
    ["OTIC CChC||Ruta Inclusión financiera", "Gestión y Talento"],
    ["OTIC CChC||Programa de Desarrollo de Proveedores", "Gestión y Talento"],
    ["OTIC CChC||Academia Pyme", "Gestión y Talento"],
    ["EAUC – PUC||Pyme UC", "Gestión y Talento"],
    ["Multigremial Nacional||Academia Emprendedores", "Gestión y Talento"],
    ["Multigremial Nacional||Ferias y Encuentros Empresariales", "Mercado"],
  ].map(([k, v]) => [k.toLowerCase(), v])
);

const norm = (s) => String(s ?? "").trim().toLowerCase();

const res = await sheets.spreadsheets.values.get({
  spreadsheetId,
  range: `${TAB}!A1:U60`,
});
const values = res.data.values ?? [];

// Detectar header
let headerIdx = -1;
for (let i = 0; i < Math.min(values.length, 5); i++) {
  if (norm(values[i]?.[0]) === "socio") {
    headerIdx = i;
    break;
  }
}
if (headerIdx < 0) {
  console.error("No se encontró header en", TAB);
  process.exit(1);
}

const header = values[headerIdx].map(norm);
const colSocio = header.findIndex((h) => h === "socio");
const colSol = header.findIndex((h) => h.startsWith("soluc"));
const colEje = header.findIndex((h) => h === "eje");
if (colEje < 0) {
  console.error("No se encontró columna 'Eje' en", TAB);
  process.exit(1);
}

const ejeColLetter = String.fromCharCode("A".charCodeAt(0) + colEje);

const updates = [];
const noMatch = [];
for (let i = headerIdx + 1; i < values.length; i++) {
  const row = values[i] || [];
  const socio = String(row[colSocio] ?? "").trim();
  const sol = String(row[colSol] ?? "").trim();
  if (!socio || !sol) continue;
  const key = `${socio}||${sol}`.toLowerCase();
  const eje = MAP.get(key);
  if (!eje) {
    noMatch.push(`${socio} / ${sol}`);
    continue;
  }
  const currentEje = String(row[colEje] ?? "").trim();
  if (currentEje === eje) continue;
  // Sheets es 1-based, header en `i` → fila real i+1
  const rowNumber = i + 1;
  updates.push({
    range: `${TAB}!${ejeColLetter}${rowNumber}`,
    values: [[eje]],
  });
  console.log(`  ${socio} / ${sol}: "${currentEje}" → "${eje}"`);
}

if (noMatch.length > 0) {
  console.log("\nFilas sin mapping (no se tocaron):");
  for (const k of noMatch) console.log(`  - ${k}`);
}

if (updates.length === 0) {
  console.log("\n✓ Nada que actualizar — todos los ejes ya están correctos.");
  process.exit(0);
}

console.log(`\nAplicando ${updates.length} cambios…`);
await sheets.spreadsheets.values.batchUpdate({
  spreadsheetId,
  requestBody: {
    valueInputOption: "USER_ENTERED",
    data: updates,
  },
});
console.log("✓ Listo.");
