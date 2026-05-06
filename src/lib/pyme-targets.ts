/**
 * Helpers de agregación sobre `PymeKpis` (común a socios y partners).
 * Los datos vienen de las pestañas KPIs_PYMEs y KPIs_PYMEs_Partners del Sheet.
 */

import type { PymeKpis } from "./types";

/** Suma de metas sin doble-contar `pymeSharedGroup`. */
export function totalPymeMeta(items: PymeKpis[]): { total: number; counted: number } {
  let total = 0;
  let counted = 0;
  const seenGroups = new Set<string>();
  for (const s of items) {
    if (s.pymeMeta == null) continue;
    if (s.pymeSharedGroup) {
      if (seenGroups.has(s.pymeSharedGroup)) continue;
      seenGroups.add(s.pymeSharedGroup);
    }
    total += s.pymeMeta;
    counted++;
  }
  return { total, counted };
}

/** Suma de acumulados sin doble-contar `pymeSharedGroup`. */
export function totalPymeAcum(items: PymeKpis[]): { total: number; counted: number } {
  let total = 0;
  let counted = 0;
  const seenGroups = new Set<string>();
  for (const s of items) {
    if (s.pymeAcum == null) continue;
    if (s.pymeSharedGroup) {
      if (seenGroups.has(s.pymeSharedGroup)) continue;
      seenGroups.add(s.pymeSharedGroup);
    }
    total += s.pymeAcum;
    counted++;
  }
  return { total, counted };
}

/** Agrupa items por eje (Capital/Mercado/Productividad/Talento) y devuelve totales. */
export function totalsByEje(items: PymeKpis[]): Map<string, { meta: number; acum: number; count: number }> {
  const out = new Map<string, { meta: number; acum: number; count: number }>();
  const seenMetaGroups = new Set<string>();
  const seenAcumGroups = new Set<string>();
  for (const s of items) {
    const eje = s.eje?.trim() || "Sin eje";
    if (!out.has(eje)) out.set(eje, { meta: 0, acum: 0, count: 0 });
    const acc = out.get(eje)!;
    acc.count++;
    if (s.pymeMeta != null) {
      const groupKey = s.pymeSharedGroup ? `${eje}|${s.pymeSharedGroup}` : null;
      if (!groupKey || !seenMetaGroups.has(groupKey)) {
        if (groupKey) seenMetaGroups.add(groupKey);
        acc.meta += s.pymeMeta;
      }
    }
    if (s.pymeAcum != null) {
      const groupKey = s.pymeSharedGroup ? `${eje}|${s.pymeSharedGroup}` : null;
      if (!groupKey || !seenAcumGroups.has(groupKey)) {
        if (groupKey) seenAcumGroups.add(groupKey);
        acc.acum += s.pymeAcum;
      }
    }
  }
  return out;
}
