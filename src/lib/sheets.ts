import { google } from "googleapis";

export type SheetRow = {
  socio: string;
  solucion: string;
  etapa: string;
  responsable: string;
  estado: string;
  semanas: string[]; // marcadores semanales (X / "")
};

export type SheetData = {
  weeks: string[]; // headers de semanas (06-Apr, 13-Apr, ...)
  rows: SheetRow[];
  fetchedAt: number;
};

let cache: { data: SheetData; expiresAt: number } | null = null;
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutos

function getJwtClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;
  if (!email || !rawKey) {
    throw new Error(
      "Faltan GOOGLE_SERVICE_ACCOUNT_EMAIL o GOOGLE_PRIVATE_KEY en las variables de entorno."
    );
  }
  // Vercel/Next a veces escapa los \n; normalizamos a saltos reales.
  const key = rawKey.replace(/\\n/g, "\n");
  return new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
}

export async function fetchSheet(force = false): Promise<SheetData> {
  if (!force && cache && cache.expiresAt > Date.now()) {
    return cache.data;
  }

  const sheetId = process.env.SHEET_ID;
  const range = process.env.SHEET_RANGE || "Gantt!A1:AT200";
  if (!sheetId) throw new Error("Falta SHEET_ID en las variables de entorno.");

  const auth = getJwtClient();
  const sheets = google.sheets({ version: "v4", auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range,
  });

  const values = res.data.values ?? [];

  // Estructura esperada (basada en Plan_Trabajo_VP_Proyectos_2026):
  //   Fila con headers semanales: cols 5+ contienen fechas (06-Apr, 13-Apr, ...)
  //   Filas de datos: [Socio, Solución, Etapa, Responsable, Estado, X/blank por semana...]
  // Buscamos la fila de header semanal (la que contiene tokens estilo "06-Apr").
  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(values.length, 10); i++) {
    const row = values[i] || [];
    const matchesDate = row.some((c) => /^\d{1,2}-[A-Za-z]{3}$/.test(String(c).trim()));
    if (matchesDate) {
      headerRowIdx = i;
      break;
    }
  }

  let weeks: string[] = [];
  let dataStart = 0;
  if (headerRowIdx >= 0) {
    weeks = (values[headerRowIdx] || []).slice(5).map((c) => String(c));
    dataStart = headerRowIdx + 1;
  }

  // Carry forward de socio y solución cuando vienen vacíos en filas de etapa.
  let lastSocio = "";
  let lastSolucion = "";

  const rows: SheetRow[] = [];
  for (let i = dataStart; i < values.length; i++) {
    const row = values[i] || [];
    if (row.length === 0) continue;

    const socio = String(row[0] || "").trim() || lastSocio;
    const solucion = String(row[1] || "").trim() || lastSolucion;
    const etapa = String(row[2] || "").trim();
    const responsable = String(row[3] || "").trim();
    const estado = String(row[4] || "").trim();

    if (!etapa && !solucion && !socio) continue;

    if (socio) lastSocio = socio;
    if (solucion) lastSolucion = solucion;

    const semanas = weeks.map((_, idx) => {
      const v = row[5 + idx];
      return v ? String(v).trim() : "";
    });

    rows.push({ socio, solucion, etapa, responsable, estado, semanas });
  }

  const data: SheetData = { weeks, rows, fetchedAt: Date.now() };
  cache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
  return data;
}

export function clearSheetCache() {
  cache = null;
}
