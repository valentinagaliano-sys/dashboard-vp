import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
for (const line of raw.split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  let [, k, v] = m;
  if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
  if (!(k in process.env)) process.env[k] = v;
}

// Compilamos TS al vuelo via tsx no — vamos a importar usando next no — usamos script aparte.
// Simplemente probamos llamando a la API de Google sin el compilador y replicamos lógica corta.
import { google } from "googleapis";

const auth = new google.auth.JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});

const sheets = google.sheets({ version: "v4", auth });
const sheetId = process.env.SHEET_ID;

const res = await sheets.spreadsheets.values.batchGet({
  spreadsheetId: sheetId,
  ranges: [`'3. Gantt por solución'!A1:AT200`, `'4. Consolidado (etapas x sol)'!A1:L80`],
});

const consolidado = res.data.valueRanges?.[1]?.values ?? [];
console.log(`Consolidado: ${consolidado.length} filas`);
let headerIdx = -1;
for (let i = 0; i < 8; i++) {
  const row = consolidado[i] || [];
  if ((row[0] ?? "").toString().toLowerCase().trim() === "socio") {
    headerIdx = i;
    break;
  }
}
console.log("Header idx:", headerIdx);

console.log("\nSoluciones detectadas:");
for (let i = headerIdx + 1; i < consolidado.length; i++) {
  const row = consolidado[i] || [];
  const socio = (row[0] ?? "").toString().trim();
  const solucion = (row[1] ?? "").toString().trim();
  if (!socio || !solucion) continue;
  if (socio.toLowerCase().includes("tareas por etapa")) break;
  const avance = (row[7] ?? "").toString().trim();
  const hito = (row[8] ?? "").toString().trim();
  const fecha = (row[9] ?? "").toString().trim();
  console.log(`  [${socio}] ${solucion} → ${avance} | ${hito} | ${fecha}`);
}

// Detalle ejemplo
const det = await sheets.spreadsheets.values.get({
  spreadsheetId: sheetId,
  range: `'Det_BCI_CtaDigital'!A1:AZ80`,
});
const detVals = det.data.values ?? [];
let etapaCount = 0;
let tareaCount = 0;
let inEtapa = false;
let firstHeaderIdx = -1;
for (let i = 0; i < detVals.length; i++) {
  const row = detVals[i] || [];
  if ((row[0] ?? "").toString().toLowerCase() === "etapa" && (row[1] ?? "").toString().toLowerCase() === "tarea") {
    firstHeaderIdx = i;
    break;
  }
}
for (let i = firstHeaderIdx + 1; i < detVals.length; i++) {
  const row = detVals[i] || [];
  const c0 = (row[0] ?? "").toString().trim();
  const c1 = (row[1] ?? "").toString().trim();
  if (c0 && /^\d\./.test(c0)) {
    etapaCount++;
    inEtapa = true;
    continue;
  }
  if (!c0 && c1 && !c1.startsWith("[Resumen")) {
    tareaCount++;
  }
}
console.log(`\nDet_BCI_CtaDigital: ${etapaCount} etapas, ${tareaCount} tareas`);
