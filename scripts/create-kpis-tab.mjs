/**
 * Crea (o recrea) las pestañas `KPIs_PYMEs` (socios) y `KPIs_PYMEs_Partners`
 * en el Sheet, con histórico mensual y columna `Eje`.
 *
 * Estructura común:
 *   <Socio|Partner> | Solución | Eje | Unidad | Meta 2026 | Ene..Dic | Segmentos | Notas | Grupo compartido | Fuente
 *
 * Si la pestaña ya existe se renombra a `<nombre>_old_<timestamp>` para
 * preservar la data del cliente; correr de nuevo crea la pestaña limpia.
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
// Sheet con la lista oficial de partners (pestaña "Seleccionados").
const PARTNERS_SOURCE_SHEET_ID = "1vPHSBTEizYHyT2hJ7Iy2W9bB-GzXAQnPH_ugIryTPWY";
const PARTNERS_SOURCE_TAB = "Seleccionados";

// Canónicos: Capital, Mercado, Digitalización, Gestión y Talento.
const EJE_NORMALIZE = {
  "capital": "Capital",
  "mercado": "Mercado",
  "digitalización": "Digitalización",
  "digitalizacion": "Digitalización",
  "productividad": "Digitalización",
  "talento": "Gestión y Talento",
  "gestión y talento": "Gestión y Talento",
  "gestion y talento": "Gestión y Talento",
};

function normalizeEje(raw) {
  if (!raw) return "";
  const k = raw.trim().toLowerCase();
  return EJE_NORMALIZE[k] ?? raw.trim();
}

/**
 * Extrae el primer número que aparezca en una celda multilínea de "Metas".
 * Acepta "20.000", "20,000", "20K", "200 PYMEs adoptando la solución".
 */
function extractFirstNumber(text) {
  if (!text) return null;
  const m = text.match(/(\d{1,3}(?:[.,]\d{3})+|\d+)\s*(K|M)?/i);
  if (!m) return null;
  let n = Number(m[1].replace(/[.,]/g, ""));
  if (m[2] && m[2].toUpperCase() === "K") n *= 1000;
  if (m[2] && m[2].toUpperCase() === "M") n *= 1_000_000;
  return Number.isFinite(n) ? n : null;
}

function splitMulti(cell) {
  return String(cell ?? "")
    .split(/\r?\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function loadSelectedPartners() {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: PARTNERS_SOURCE_SHEET_ID,
    range: `'${PARTNERS_SOURCE_TAB}'!A1:Z200`,
  });
  const values = res.data.values ?? [];
  if (!values.length) return [];

  // Detectar header
  let headerIdx = -1;
  for (let i = 0; i < Math.min(values.length, 5); i++) {
    if (String(values[i]?.[0] ?? "").trim().toLowerCase() === "partner") {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) return [];

  const header = values[headerIdx].map((h) => String(h ?? "").trim().toLowerCase());
  const findCol = (...cands) => {
    for (const c of cands) {
      const idx = header.findIndex((h) => h === c || h.startsWith(c));
      if (idx >= 0) return idx;
    }
    return -1;
  };
  const colPartner = findCol("partner");
  const colNumSol = findCol("n° soluciones", "n soluciones", "nro soluciones", "numero soluciones");
  const colSols = findCol("solución/es", "solucion/es", "soluciones", "solución", "solucion");
  const colSegm = findCol("segmentación", "segmentacion", "segmento");
  const colEje = findCol("eje");
  const colBen = findCol("beneficio");
  const colMetas = findCol("metas", "meta");
  const colPlazo = findCol("plazo");

  const rowsOut = [];
  for (let i = headerIdx + 1; i < values.length; i++) {
    const row = values[i] || [];
    const partner = String(row[colPartner] ?? "").trim();
    if (!partner) continue;
    const numSol = colNumSol >= 0 ? String(row[colNumSol] ?? "").trim() : "";
    const numSolNum = Number(numSol);
    if (numSol === "0" || numSolNum === 0) continue; // skip partners sin solución

    const sols = splitMulti(row[colSols] ?? "");
    if (sols.length === 0) continue;

    const ejes = splitMulti(row[colEje] ?? "").map(normalizeEje);
    const metas = splitMulti(row[colMetas] ?? "");
    const segm = String(row[colSegm] ?? "").trim();
    const beneficio = String(row[colBen] ?? "").trim();
    const plazo = String(row[colPlazo] ?? "").trim();

    sols.forEach((sol, idx) => {
      const eje = ejes[idx] ?? ejes[0] ?? "";
      const metaText = metas[idx] ?? metas[0] ?? "";
      const meta = extractFirstNumber(metaText);
      const fuente = "Sheet '0. Categorías de Partners' · pestaña Seleccionados";
      const notasParts = [];
      if (metaText) notasParts.push(metaText);
      if (beneficio && idx === 0) notasParts.push(`Beneficio: ${beneficio}`);
      if (plazo && idx === 0) notasParts.push(`Plazo: ${plazo}`);
      rowsOut.push([
        partner,
        sol,
        eje,
        "pymes",
        meta ?? "",
        segm,
        notasParts.join(" · "),
        "",
        fuente,
      ]);
    });
  }
  return rowsOut;
}

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const EJES = ["Capital", "Mercado", "Productividad", "Talento"];

function buildHeader(firstColLabel) {
  return [
    firstColLabel,
    "Solución",
    "Eje",
    "Unidad",
    "Meta 2026",
    ...MONTHS,
    "Segmentos",
    "Notas",
    "Grupo compartido",
    "Fuente",
  ];
}

// Filas de SOCIOS (programa principal). El eje aquí actúa como fallback;
// el dashboard usa el eje del Gantt como fuente de verdad cuando está presente.
const SOCIOS_ROWS = [
  ["BCI", "Cuenta Digital", "Capital", "pymes"],
  ["BCI", "Modelo Nace Emprendimiento", "Capital", "pymes"],
  ["Walmart", "Marketplace", "Mercado", "pymes"],
  ["Blue Express", "Cupón descuento despacho", "Mercado", "pymes"],
  ["Defontana", "Contabilidad Gratuita / ERP", "Digitalización", "empresas"],
  ["Defontana", "Defontana Digital", "Digitalización", "empresas"],
  ["Microsoft", "Elevate", "Gestión y Talento", "pymes"],
  ["Microsoft", "Agente Copilot", "Gestión y Talento", "pymes"],
  ["Microsoft", "Ciberseguridad", "Gestión y Talento", "pymes"],
  ["OTIC CChC", "Ruta Inclusión financiera", "Gestión y Talento", "trabajadores"],
  ["OTIC CChC", "Programa de Desarrollo de Proveedores", "Gestión y Talento", "trabajadores"],
  ["OTIC CChC", "Academia Pyme", "Gestión y Talento", "pymes"],
  ["EAUC – PUC", "Pyme UC", "Gestión y Talento", "pymes"],
  ["Multigremial Nacional", "Academia Emprendedores", "Gestión y Talento", "pymes"],
  ["Multigremial Nacional", "Ferias y Encuentros Empresariales", "Mercado", "pymes"],
];

// PARTNERS_ROWS se cargan dinámicamente desde la pestaña "Seleccionados" del
// sheet remoto de partners (ver loadSelectedPartners más arriba).

async function ensureTab(title, header, dataRows) {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(title,sheetId)",
  });
  const existing = (meta.data.sheets ?? []).find((s) => s.properties?.title === title);
  if (existing) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const newTitle = `${title}_old_${stamp}`;
    console.log(`[${title}] Renombrando vieja → "${newTitle}"…`);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            updateSheetProperties: {
              properties: { sheetId: existing.properties.sheetId, title: newTitle },
              fields: "title",
            },
          },
        ],
      },
    });
  }

  const totalCols = header.length;
  console.log(`[${title}] Creando nueva pestaña…`);
  const addRes = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: {
              title,
              gridProperties: {
                rowCount: Math.max(60, dataRows.length + 5),
                columnCount: totalCols,
                frozenRowCount: 1,
                frozenColumnCount: 2,
              },
            },
          },
        },
      ],
    },
  });
  const sheetId = addRes.data.replies?.[0]?.addSheet?.properties?.sheetId;

  // Padea filas al ancho del header.
  // Header columnas (idx): 0=Partner|Socio, 1=Solución, 2=Eje, 3=Unidad, 4=Meta 2026,
  //   5..16=Ene..Dic, 17=Segmentos, 18=Notas, 19=Grupo compartido, 20=Fuente.
  //
  // Soportamos dos shapes de fila:
  //   - 4 cols: [entity, sol, eje, unidad] → resto vacío (socios).
  //   - 9 cols: [entity, sol, eje, unidad, meta, segmentos, notas, sharedGroup, fuente]
  //             → meses vacíos en medio (partners desde loadSelectedPartners).
  const PADDED = dataRows.map((r) => {
    const padded = Array(totalCols).fill("");
    if (r.length === 4) {
      const [entity, sol, eje, unidad] = r;
      padded[0] = entity;
      padded[1] = sol;
      padded[2] = eje;
      padded[3] = unidad;
      return padded;
    }
    const [entity, sol, eje, unidad, meta, segm, notas, sharedGroup, fuente] = r;
    padded[0] = entity;
    padded[1] = sol;
    padded[2] = eje;
    padded[3] = unidad;
    padded[4] = meta ?? "";
    // 5..16: 12 meses vacíos
    padded[17] = segm ?? "";
    padded[18] = notas ?? "";
    padded[19] = sharedGroup ?? "";
    padded[20] = fuente ?? "";
    return padded;
  });

  console.log(`[${title}] Escribiendo header + ${PADDED.length} filas…`);
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${title}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [header, ...PADDED] },
  });

  // Validación: dropdown de ejes en columna C (idx 2)
  const FIRST_MONTH_COL = 5;
  const LAST_MONTH_COL = 5 + 11;
  const META_COL_IDX = 4;

  console.log(`[${title}] Aplicando formato + validación de Eje…`);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          repeatCell: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.18, green: 0.28, blue: 0.7 },
                textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true },
                horizontalAlignment: "CENTER",
              },
            },
            fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)",
          },
        },
        {
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: 0,
              endRowIndex: 1,
              startColumnIndex: FIRST_MONTH_COL,
              endColumnIndex: LAST_MONTH_COL + 1,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.12, green: 0.55, blue: 0.45 },
                textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true },
                horizontalAlignment: "CENTER",
              },
            },
            fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)",
          },
        },
        {
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: 1,
              startColumnIndex: META_COL_IDX,
              endColumnIndex: LAST_MONTH_COL + 1,
            },
            cell: {
              userEnteredFormat: {
                numberFormat: { type: "NUMBER", pattern: "#,##0" },
                horizontalAlignment: "RIGHT",
              },
            },
            fields: "userEnteredFormat(numberFormat,horizontalAlignment)",
          },
        },
        // Data validation: Eje (col C, idx 2) limitado a EJES
        {
          setDataValidation: {
            range: {
              sheetId,
              startRowIndex: 1,
              startColumnIndex: 2,
              endColumnIndex: 3,
            },
            rule: {
              condition: {
                type: "ONE_OF_LIST",
                values: EJES.map((e) => ({ userEnteredValue: e })),
              },
              showCustomUi: true,
              strict: false,
            },
          },
        },
        {
          autoResizeDimensions: {
            dimensions: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: totalCols },
          },
        },
      ],
    },
  });

  console.log(`[${title}] ✓ lista con ${PADDED.length} filas.`);
}

const args = process.argv.slice(2);
const partnersOnly = args.includes("--partners-only");
const sociosOnly = args.includes("--socios-only");

console.log("=== Recreando pestañas KPIs ===\n");

if (!partnersOnly) {
  await ensureTab("KPIs_PYMEs", buildHeader("Socio"), SOCIOS_ROWS);
  console.log();
}

let partnersCount = 0;
if (!sociosOnly) {
  console.log("Cargando partners desde sheet remoto · pestaña 'Seleccionados'…");
  const PARTNERS_ROWS = await loadSelectedPartners();
  partnersCount = PARTNERS_ROWS.length;
  console.log(`  ${PARTNERS_ROWS.length} filas de partner/solución obtenidas.\n`);
  await ensureTab("KPIs_PYMEs_Partners", buildHeader("Partner"), PARTNERS_ROWS);
}

console.log("\n✓ Listo.");
if (!partnersOnly) console.log(`  KPIs_PYMEs: ${SOCIOS_ROWS.length} socios × 12 meses`);
if (!sociosOnly) console.log(`  KPIs_PYMEs_Partners: ${partnersCount} partners × 12 meses`);
