export type EtapaName =
  | "1. Preparación"
  | "2. Convocatoria"
  | "3. Adopción"
  | "4. Acompañamiento"
  | "5. Evaluación";

export const ETAPAS: EtapaName[] = [
  "1. Preparación",
  "2. Convocatoria",
  "3. Adopción",
  "4. Acompañamiento",
  "5. Evaluación",
];

export type Estado = "En curso" | "Pendiente" | "Terminado" | "No aplica" | "";

/**
 * Roles del dashboard:
 *  - admin   = vista global. Incluye al equipo FE Consulting y a los directores
 *              del proyecto (BCI). Ven cartera completa, KPIs, comentarios
 *              internos.
 *  - partner = empresa socia, ve sólo sus soluciones. Sin KPIs globales,
 *              sin comentarios internos, sin proyección agregada.
 */
export type Role = "admin" | "partner";

export type ResolvedUser = {
  role: Role;
  partner: string | null; // null para FE; string para BCI (admin) y para socios.
  label: string;          // "Administrador" o "Empresa"
  subLabel?: string;      // "FE Consulting" / "Director · BCI" / nombre del socio
};

/** Fila plana del Gantt (tab 3): cobertura por etapa, sin tareas. */
export type GanttRow = {
  socio: string;
  solucion: string;
  etapa: string;
  responsable: string;
  estado: string;
  semanas: string[];
};

/** Resumen ejecutivo por solución (tab 4 — Consolidado). */
export type SolutionSummary = {
  socio: string;
  solucion: string;
  slug: string;
  detTab: string | null;
  etapas: { etapa: EtapaName; estado: Estado }[];
  avance: number; // 0..100
  proximoHito: string;
  fechaHito: string;
  comentarios: string;
};

/** Detalle por solución (tabs Det_*). */
export type SolutionDetail = {
  slug: string;
  socio: string;
  solucion: string;
  responsableFE: string;
  avance: number;
  weeks: string[];
  etapas: EtapaDetail[];
};

export type EtapaDetail = {
  etapa: string;
  responsable: string;
  estado: Estado;
  semanas: string[];
  tareas: Tarea[];
};

export type Tarea = {
  nombre: string;
  responsable: string;
  estado: Estado;
  inicio: string;
  fin: string;
  comentarios: string;
};
