import { google } from "googleapis";
import {
  type GanttRow,
  type SolutionSummary,
  type SolutionDetail,
  type EtapaDetail,
  type Tarea,
  type Estado,
  ETAPAS,
} from "./types";
import { canonicalPartner, findDetTab, findSolutionByTab, solutionSlug } from "./solutions";

const GANTT_TAB = "3. Gantt por solución";
const CONSOLIDADO_TAB = "4. Consolidado (etapas x sol)";
const CACHE_TTL_MS = 2 * 60 * 1000;

type AggregateData = {
  weeks: string[];
  ganttRows: GanttRow[];
  summaries: SolutionSummary[];
  fetchedAt: number;
};

let aggregateCache: { data: AggregateData; expiresAt: number } | null = null;
const detailCache = new Map<string, { data: SolutionDetail; expiresAt: number }>();

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;
  if (!email || !rawKey) {
    throw new Error("Faltan GOOGLE_SERVICE_ACCOUNT_EMAIL o GOOGLE_PRIVATE_KEY.");
  }
  return new google.auth.JWT({
    email,
    key: rawKey.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
}

function sheetsClient() {
  return google.sheets({ version: "v4", auth: getAuth() });
}

function getSheetId() {
  const id = process.env.SHEET_ID;
  if (!id) throw new Error("Falta SHEET_ID.");
  return id;
}

/** Trim whitespace, devuelve string limpio. */
function s(v: unknown): string {
  return String(v ?? "").trim();
}

function parseEstado(raw: string): Estado {
  const e = raw.trim();
  if (!e) return "";
  const low = e.toLowerCase();
  if (low.includes("curso")) return "En curso";
  if (low.includes("term") || low.includes("listo") || low.includes("comple")) return "Terminado";
  if (low.includes("pend")) return "Pendiente";
  if (low.includes("no aplica") || low === "n/a") return "No aplica";
  return e as Estado;
}

function parsePercent(raw: string): number {
  const m = raw.replace(/\s/g, "").match(/([\d]+)\s*%/);
  if (m) return Math.max(0, Math.min(100, Number(m[1])));
  const num = Number(raw);
  if (!isNaN(num)) {
    if (num <= 1) return Math.round(num * 100);
    return Math.max(0, Math.min(100, num));
  }
  return 0;
}

export async function fetchAggregate(force = false): Promise<AggregateData> {
  if (!force && aggregateCache && aggregateCache.expiresAt > Date.now()) {
    return aggregateCache.data;
  }

  const sheetId = getSheetId();
  const sheets = sheetsClient();
  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: sheetId,
    ranges: [`'${GANTT_TAB}'!A1:AT200`, `'${CONSOLIDADO_TAB}'!A1:L80`],
  });

  const ganttValues = res.data.valueRanges?.[0]?.values ?? [];
  const consolidadoValues = res.data.valueRanges?.[1]?.values ?? [];

  const { weeks, rows: ganttRows } = parseGantt(ganttValues);
  const summaries = parseConsolidado(consolidadoValues);

  const data: AggregateData = { weeks, ganttRows, summaries, fetchedAt: Date.now() };
  aggregateCache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
  return data;
}

function parseGantt(values: any[][]): { weeks: string[]; rows: GanttRow[] } {
  // Buscar fila con fechas tipo "06-Apr"
  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(values.length, 10); i++) {
    const row = values[i] || [];
    if (row.some((c) => /^\d{1,2}-[A-Za-z]{3}$/.test(s(c)))) {
      headerRowIdx = i;
      break;
    }
  }
  if (headerRowIdx < 0) return { weeks: [], rows: [] };

  const weeks = (values[headerRowIdx] || []).slice(5).map(s).filter(Boolean);
  const rows: GanttRow[] = [];
  let lastSocio = "";
  let lastSolucion = "";

  for (let i = headerRowIdx + 1; i < values.length; i++) {
    const row = values[i] || [];
    if (row.length === 0) continue;
    const socio = s(row[0]) || lastSocio;
    const solucion = s(row[1]) || lastSolucion;
    const etapa = s(row[2]);
    const responsable = s(row[3]);
    const estado = s(row[4]);
    if (!etapa) continue;
    if (socio) lastSocio = socio;
    if (solucion) lastSolucion = solucion;
    const semanas = weeks.map((_, idx) => s(row[5 + idx]));
    rows.push({ socio, solucion, etapa, responsable, estado, semanas });
  }
  return { weeks, rows };
}

function parseConsolidado(values: any[][]): SolutionSummary[] {
  // Header esperado: Socio | Solución | 1.Prep | 2.Conv | 3.Adop | 4.Acomp | 5.Eval | %Avance | Próximo hito | Fecha | Comentarios
  let headerIdx = -1;
  for (let i = 0; i < Math.min(values.length, 8); i++) {
    const row = values[i] || [];
    if (s(row[0]).toLowerCase() === "socio" && s(row[1]).toLowerCase().startsWith("soluc")) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) return [];

  const out: SolutionSummary[] = [];
  for (let i = headerIdx + 1; i < values.length; i++) {
    const row = values[i] || [];
    const socioRaw = s(row[0]);
    const solucion = s(row[1]);
    // Sentinel: la pestaña tiene una segunda tabla de descripciones de etapa
    // ("TAREAS POR ETAPA …") cuya primera columna trae "1. Preparación", "2. Convocatoria", etc.
    // Cortamos cuando vemos el header de esa sección o cuando la primera columna no es un socio reconocido.
    if (socioRaw.toLowerCase().includes("tareas por etapa")) break;
    if (/^\d+\.\s/.test(socioRaw)) break;
    if (!socioRaw || !solucion) continue;

    const canonical = canonicalPartner(socioRaw);
    if (!canonical) continue;
    const socio = canonical;
    const etapas = ETAPAS.map((etapa, idx) => ({
      etapa,
      estado: parseEstado(s(row[2 + idx])),
    }));
    const avance = parsePercent(s(row[7]));
    const proximoHito = s(row[8]);
    const fechaHito = s(row[9]);
    const comentarios = s(row[10]);
    const detTab = findDetTab(socio, solucion);

    out.push({
      socio,
      solucion,
      slug: solutionSlug(socio, solucion),
      detTab,
      etapas,
      avance,
      proximoHito,
      fechaHito,
      comentarios,
    });
  }
  return out;
}

export async function fetchSolutionDetail(tab: string, force = false): Promise<SolutionDetail> {
  const cached = detailCache.get(tab);
  if (!force && cached && cached.expiresAt > Date.now()) return cached.data;

  const sheets = sheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getSheetId(),
    range: `'${tab}'!A1:AZ80`,
  });
  const values = res.data.values ?? [];
  const detail = parseDetail(tab, values);
  detailCache.set(tab, { data: detail, expiresAt: Date.now() + CACHE_TTL_MS });
  return detail;
}

function parseDetail(tab: string, values: any[][]): SolutionDetail {
  const meta = findSolutionByTab(tab);
  const titleRow = values[0] || [];
  const infoRow = values[1] || [];

  // Extraer responsable FE y avance del row 1
  // Formato: ["Socio: BCI","","Solución: ...","","Responsable FE:","","AP","% Avance (hoja 4):","","","","","40%"]
  let responsableFE = "";
  let avance = 0;
  for (let i = 0; i < infoRow.length; i++) {
    const cell = s(infoRow[i]).toLowerCase();
    if (cell.startsWith("responsable")) {
      // siguiente celda no vacía
      for (let j = i + 1; j < Math.min(i + 4, infoRow.length); j++) {
        const v = s(infoRow[j]);
        if (v) {
          responsableFE = v;
          break;
        }
      }
    }
    if (cell.includes("% avance") || cell.includes("avance")) {
      for (let j = i + 1; j < infoRow.length; j++) {
        const v = s(infoRow[j]);
        if (v && /\d/.test(v)) {
          avance = parsePercent(v);
          break;
        }
      }
    }
  }

  // Buscar fila de header con "Etapa","Tarea","Responsable","Estado","Inicio","Fin","Comentarios"
  let headerIdx = -1;
  for (let i = 0; i < Math.min(values.length, 10); i++) {
    const row = values[i] || [];
    if (s(row[0]).toLowerCase() === "etapa" && s(row[1]).toLowerCase() === "tarea") {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) {
    return {
      slug: meta ? solutionSlug(meta.partner, meta.solucion) : tab,
      socio: meta?.partner ?? "",
      solucion: meta?.solucion ?? s(titleRow[0]),
      responsableFE,
      avance,
      weeks: [],
      etapas: [],
    };
  }

  const headerRow = values[headerIdx] || [];
  const weeks = headerRow.slice(7).map(s).filter(Boolean);

  const etapas: EtapaDetail[] = [];
  let current: EtapaDetail | null = null;

  for (let i = headerIdx + 1; i < values.length; i++) {
    const row = values[i] || [];
    if (row.length === 0) continue;
    const c0 = s(row[0]);
    const c1 = s(row[1]);

    // Fila de etapa: c0 con "1. Preparación" y c1 con "[Resumen etapa..."
    if (c0 && /^\d\./.test(c0)) {
      current = {
        etapa: c0,
        responsable: s(row[2]),
        estado: parseEstado(s(row[3])),
        semanas: weeks.map((_, idx) => s(row[7 + idx])),
        tareas: [],
      };
      etapas.push(current);
      continue;
    }

    // Fila de tarea: c0 vacía, c1 con texto. Skipeamos si c1 empieza con "[Resumen"
    if (!c0 && c1 && !c1.startsWith("[Resumen")) {
      const tarea: Tarea = {
        nombre: c1,
        responsable: s(row[2]),
        estado: parseEstado(s(row[3])),
        inicio: s(row[4]),
        fin: s(row[5]),
        comentarios: s(row[6]),
      };
      if (current) current.tareas.push(tarea);
    }
  }

  return {
    slug: meta ? solutionSlug(meta.partner, meta.solucion) : tab,
    socio: meta?.partner ?? "",
    solucion: meta?.solucion ?? "",
    responsableFE,
    avance,
    weeks,
    etapas,
  };
}

export function clearAllCache() {
  aggregateCache = null;
  detailCache.clear();
}
