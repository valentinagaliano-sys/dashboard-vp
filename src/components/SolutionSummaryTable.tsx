import type { Estado, EtapaName, SolutionSummary } from "@/lib/types";
import { ETAPAS } from "@/lib/types";
import { ETAPA_LABELS } from "@/lib/solutions";
import { getPymeTarget } from "@/lib/pyme-targets";
import Link from "next/link";

const QUARTER_RAMP = [0.05, 0.25, 0.6, 1.0];

const CELL_BY_ESTADO: Record<Estado, string> = {
  "En curso": "bg-emerald-100/80 text-emerald-800",
  Terminado: "bg-blue-100/80 text-blue-800",
  Pendiente: "bg-gray-50 text-gray-500",
  "No aplica": "bg-gray-50 text-gray-300",
  "": "bg-gray-50 text-gray-400",
};

function formatNumber(n: number): string {
  return n.toLocaleString("es-CL");
}

function avanceColor(v: number): string {
  if (v >= 80) return "text-blue-700";
  if (v >= 50) return "text-emerald-700";
  if (v >= 20) return "text-amber-700";
  return "text-red-600";
}

function fechaDisplay(fecha: string): { value: string; tone: "amber" | "neutral" } {
  if (!fecha) return { value: "—", tone: "neutral" };
  if (fecha.toLowerCase() === "pendiente") return { value: "Pendiente", tone: "amber" };
  return { value: fecha, tone: "neutral" };
}

export function SolutionSummaryTable({
  summaries,
  showSocio = true,
  today = new Date(),
}: {
  summaries: SolutionSummary[];
  showSocio?: boolean;
  today?: Date;
}) {
  if (summaries.length === 0) return null;

  const todayQ = Math.floor(today.getMonth() / 3);
  const refRamp = QUARTER_RAMP[todayQ] || 1;

  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full min-w-[1100px] border-separate border-spacing-0 text-sm">
        <thead>
          <tr className="bg-brand-700 text-white">
            {showSocio && (
              <th className="sticky left-0 z-10 bg-brand-700 px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider">
                Socio
              </th>
            )}
            <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider">
              Solución
            </th>
            {ETAPAS.map((e: EtapaName) => (
              <th
                key={e}
                className="px-2 py-3 text-center text-[11px] font-semibold uppercase tracking-wider"
              >
                <div className="leading-tight">{e.split(".")[0]}.</div>
                <div className="leading-tight">{ETAPA_LABELS[e]}</div>
              </th>
            ))}
            <th className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wider">
              % Avance
            </th>
            <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider">
              PYMEs · acum / meta 2026
            </th>
            <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider">
              Próximo hito
            </th>
            <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider">
              Fecha
            </th>
          </tr>
        </thead>
        <tbody>
          {summaries.map((s, idx) => {
            const target = getPymeTarget(s.slug);
            const meta = target?.pymeTarget ?? null;
            const acum =
              meta != null ? Math.round(meta * (s.avance / 100) * (1 / refRamp) * QUARTER_RAMP[todayQ]) : null;
            const pct = meta != null && meta > 0 && acum != null ? Math.min(100, (acum / meta) * 100) : 0;
            const fecha = fechaDisplay(s.fechaHito);

            return (
              <tr
                key={s.slug}
                className={`border-t border-gray-100 transition hover:bg-gray-50/70 ${
                  idx === 0 ? "" : ""
                }`}
              >
                {showSocio && (
                  <td className="sticky left-0 z-[1] whitespace-nowrap border-t border-gray-100 bg-white px-3 py-2 text-xs font-medium text-gray-700">
                    {s.socio}
                  </td>
                )}
                <td className="border-t border-gray-100 px-3 py-2">
                  <Link
                    href={`/dashboard/${s.slug}`}
                    className="text-sm font-medium text-gray-900 hover:text-brand-700"
                  >
                    {s.solucion}
                  </Link>
                </td>

                {s.etapas.map((e) => (
                  <td
                    key={e.etapa}
                    className={`border-t border-l border-gray-100 px-2 py-2 text-center text-[11px] font-medium ${
                      CELL_BY_ESTADO[e.estado] ?? CELL_BY_ESTADO[""]
                    }`}
                  >
                    {e.estado || "—"}
                  </td>
                ))}

                <td className="border-t border-l border-gray-100 px-3 py-2 text-right">
                  <span className={`text-sm font-semibold tabular-nums ${avanceColor(s.avance)}`}>
                    {s.avance}%
                  </span>
                </td>

                <td className="border-t border-l border-gray-100 px-3 py-2">
                  {meta != null && acum != null ? (
                    <div>
                      <div className="flex items-baseline gap-1 text-xs tabular-nums">
                        <span className="font-semibold text-gray-900">{formatNumber(acum)}</span>
                        <span className="text-gray-400">/ {formatNumber(meta)}</span>
                        {target?.unit && target.unit !== "pymes" && (
                          <span className="text-[10px] text-gray-400">
                            ({target.unit === "trabajadores" ? "trab." : "emp."})
                          </span>
                        )}
                      </div>
                      <div className="mt-1 h-1 w-24 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className={`h-full ${
                            pct >= 80
                              ? "bg-blue-500"
                              : pct >= 50
                                ? "bg-emerald-500"
                                : pct >= 20
                                  ? "bg-amber-500"
                                  : "bg-red-400"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      {target?.sharedGroup && (
                        <p className="mt-0.5 text-[10px] text-amber-600">meta compartida</p>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">— / por definir</span>
                  )}
                </td>

                <td className="border-t border-l border-gray-100 px-3 py-2 text-xs text-gray-700">
                  <span className="line-clamp-2">{s.proximoHito || "—"}</span>
                </td>

                <td className="border-t border-l border-gray-100 px-3 py-2 text-xs">
                  <span
                    className={
                      fecha.tone === "amber"
                        ? "font-medium text-amber-700"
                        : "tabular-nums text-gray-700"
                    }
                  >
                    {fecha.value}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p className="border-t border-gray-100 bg-gray-50/40 px-4 py-2 text-[11px] text-gray-400">
        PYMEs acumuladas: estimación a la fecha (meta × % avance proyecto, distribuido en ramp-up
        estándar). Se reemplazará por adquisición real cuando el Sheet la reporte.
      </p>
    </div>
  );
}
