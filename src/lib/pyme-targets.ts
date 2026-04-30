/**
 * Metas de PYMEs por solución, extraídas del Directorio Valor Pyme 31-mar-2026
 * (slide "Adquisición Esperada 2026" + slides individuales por eje).
 *
 * Estos valores NO viven en el Sheet — son acuerdos del comité directivo.
 * Cuando el directorio del mes se actualice, hay que reflejarlo aquí.
 *
 * `pymeTarget` es la meta de **adquisición** (PYMEs que contratan la solución).
 * `sharedGroup` agrupa metas combinadas para no doble-contar en totales.
 * `alcanceTarget` es el alcance esperado (invitación / cobertura).
 */

import { solutionSlug } from "./solutions";

export type PymeTarget = {
  pymeTarget: number | null;
  unit?: "pymes" | "trabajadores" | "empresas";
  sharedGroup?: string;
  segmentos?: string;
  notas?: string;
  fuente: string;
};

const RAW: Array<[partner: string, solucion: string, t: PymeTarget]> = [
  [
    "BCI",
    "Cuenta Digital",
    {
      pymeTarget: 20_000,
      unit: "pymes",
      sharedGroup: "BCI-EjeCapital",
      segmentos: "Microempresas por necesidad y con potencial",
      notas: "Meta combinada con Modelo Nace Emprendimiento (20.000 entre ambas).",
      fuente: "Directorio 31-mar-2026 · slide Ambición 2026",
    },
  ],
  [
    "BCI",
    "Modelo Nace Emprendimiento",
    {
      pymeTarget: 20_000,
      unit: "pymes",
      sharedGroup: "BCI-EjeCapital",
      segmentos: "Pymes Innovadoras",
      notas: "Meta combinada con Cuenta Digital (20.000 entre ambas).",
      fuente: "Directorio 31-mar-2026 · slide Ambición 2026",
    },
  ],
  [
    "Walmart",
    "Marketplace",
    {
      pymeTarget: 350,
      unit: "pymes",
      sharedGroup: "Walmart-Mercado",
      notas: "Meta combinada con Programa Desarrollo de Proveedores (OTIC CChC): 350 PYMEs.",
      fuente: "Directorio 31-mar-2026 · slide Ambición 2026",
    },
  ],
  [
    "Blue Express",
    "Cupón descuento despacho",
    {
      pymeTarget: 5_000,
      unit: "pymes",
      segmentos: "Microempresas con potencial · Pequeñas tradicionales",
      notas: "Cupón 30% dscto, máx. 30 usos mensuales por pyme inscrita en VP.",
      fuente: "Directorio 31-mar-2026 · slide Eje Mercado",
    },
  ],
  [
    "Defontana",
    "Contabilidad Gratuita / ERP",
    {
      pymeTarget: 10_000,
      unit: "empresas",
      notas: "Meta de empresas nuevas suscritas. % usabilidad esperada: 10%.",
      fuente: "Directorio 31-mar-2026 · slide Eje Productividad",
    },
  ],
  [
    "Defontana",
    "Defontana Digital",
    {
      pymeTarget: 10_000,
      unit: "empresas",
      notas: "Meta de empresas nuevas suscritas. % usabilidad esperada: 8%.",
      fuente: "Directorio 31-mar-2026 · slide Eje Productividad",
    },
  ],
  [
    "Microsoft",
    "Elevate",
    { pymeTarget: null, fuente: "Directorio 31-mar-2026 · sin meta numérica reportada" },
  ],
  [
    "Microsoft",
    "Agente Copilot",
    { pymeTarget: null, fuente: "Directorio 31-mar-2026 · sin meta numérica reportada" },
  ],
  [
    "Microsoft",
    "Ciberseguridad",
    { pymeTarget: null, fuente: "Directorio 31-mar-2026 · sin meta numérica reportada" },
  ],
  [
    "OTIC CChC",
    "Ruta Inclusión financiera",
    {
      pymeTarget: 500,
      unit: "trabajadores",
      sharedGroup: "OTIC-EjeTalento-Capital",
      notas:
        "Piloto Q2: 500 trabajadores PYME · Amplificación Q2-Q3: 2.500 trabajadores PYME (eje capital con BCI).",
      fuente: "Directorio 31-mar-2026 · slide Eje Talento",
    },
  ],
  [
    "OTIC CChC",
    "Programa de Desarrollo de Proveedores",
    {
      pymeTarget: 1_400,
      unit: "trabajadores",
      sharedGroup: "Walmart-Mercado",
      notas:
        "Piloto Q2: 2 empresas / 350 trabajadores · Amplificación Q3-Q4: 6 empresas / 1.050 trabajadores. Total: 8 empresas / 1.400 trabajadores PYME.",
      fuente: "Directorio 31-mar-2026 · slide Desarrollo Proveedores",
    },
  ],
  [
    "OTIC CChC",
    "Academia Pyme",
    { pymeTarget: null, fuente: "Directorio 31-mar-2026 · sin meta numérica reportada" },
  ],
  [
    "EAUC – PUC",
    "Pyme UC",
    {
      pymeTarget: 200,
      unit: "pymes",
      sharedGroup: "EAUC-OTIC-Talento",
      notas: "Meta combinada con OTIC CChC en eje Talento: 200 PYMEs.",
      fuente: "Directorio 31-mar-2026 · slide Ambición 2026",
    },
  ],
  [
    "Multigremial Nacional",
    "Academia Emprendedores",
    { pymeTarget: null, fuente: "Directorio 31-mar-2026 · sin meta numérica reportada" },
  ],
  [
    "Multigremial Nacional",
    "Ferias y Encuentros Empresariales",
    { pymeTarget: null, fuente: "Directorio 31-mar-2026 · sin meta numérica reportada" },
  ],
];

const BY_SLUG: Map<string, PymeTarget> = new Map(
  RAW.map(([p, s, t]) => [solutionSlug(p, s), t])
);

export function getPymeTarget(slug: string): PymeTarget | null {
  return BY_SLUG.get(slug) ?? null;
}

/**
 * Suma de metas de adquisición sin doble-contar grupos compartidos.
 * Si dos soluciones comparten `sharedGroup`, la cifra del grupo se cuenta una sola vez.
 */
export function totalPymeTarget(slugs: string[]): { total: number; counted: number } {
  let total = 0;
  let counted = 0;
  const seenGroups = new Set<string>();
  for (const slug of slugs) {
    const t = BY_SLUG.get(slug);
    if (!t || t.pymeTarget == null) continue;
    if (t.sharedGroup) {
      if (seenGroups.has(t.sharedGroup)) continue;
      seenGroups.add(t.sharedGroup);
    }
    total += t.pymeTarget;
    counted++;
  }
  return { total, counted };
}

/** Metas globales del programa según el directorio (slide Ambición). */
export const PROGRAM_TARGETS = {
  adquisicion2026: 46_050,
  alcance2026: 101_000,
  // Ambición 2026 amplia
  alcanceAmplio: 1_000_000,
  adquisicionAmplia: 300_000,
  fuente: "Directorio 31-mar-2026 · slide Ambición 2026",
};
