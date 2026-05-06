import type { SolutionSummary } from "@/lib/types";
import { totalPymeMeta, totalPymeAcum } from "@/lib/pyme-targets";

function parseDateChile(s: string): Date | null {
  if (!s) return null;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]) - 1;
  const year = Number(m[3]);
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  return new Date(year, month, day);
}

function formatNumber(n: number): string {
  return n.toLocaleString("es-CL");
}

export function KpiCards({ summaries }: { summaries: SolutionSummary[] }) {
  const total = summaries.length;
  const socios = new Set(summaries.map((s) => s.socio)).size;
  const avgAvance = total === 0 ? 0 : Math.round(summaries.reduce((acc, s) => acc + s.avance, 0) / total);

  const now = new Date();
  const in14days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const hitosProximos = summaries.filter((s) => {
    const d = parseDateChile(s.fechaHito);
    return d && d >= now && d <= in14days;
  }).length;
  const hitosSinFecha = summaries.filter(
    (s) => s.proximoHito && (!s.fechaHito || s.fechaHito.toLowerCase() === "pendiente")
  ).length;

  const { total: pymesMeta } = totalPymeMeta(summaries);
  const { total: pymesAcum } = totalPymeAcum(summaries);
  const sharePct = pymesMeta > 0 ? Math.round((pymesAcum / pymesMeta) * 100) : 0;

  const pymeValue = pymesMeta > 0 || pymesAcum > 0
    ? `${formatNumber(pymesAcum)} / ${formatNumber(pymesMeta)}`
    : "—";

  const stats = [
    {
      label: "PYMEs · acum / meta 2026",
      value: pymeValue,
      sub: pymesMeta > 0 ? `${sharePct}% de avance hacia la meta` : "fuente: pestaña KPIs_PYMEs",
      accent: true,
    },
    { label: "Soluciones activas", value: total, sub: `${socios} socios` },
    { label: "Avance promedio", value: `${avgAvance}%`, sub: "ponderado por solución" },
    { label: "Hitos próximos (14 días)", value: hitosProximos, sub: "con fecha definida" },
    { label: "Hitos sin fecha", value: hitosSinFecha, sub: "requieren acción", warn: hitosSinFecha > 0 },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      {stats.map((s) => (
        <div
          key={s.label}
          className={`rounded-2xl border p-5 shadow-sm ${
            s.accent
              ? "border-brand-200 bg-gradient-to-br from-brand-50 to-white"
              : "border-gray-200 bg-white"
          }`}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{s.label}</p>
          <p
            className={`mt-2 font-semibold tabular-nums ${
              s.accent ? "text-xl lg:text-2xl" : "text-3xl"
            } ${s.warn ? "text-amber-700" : s.accent ? "text-brand-700" : "text-gray-900"}`}
          >
            {s.value}
          </p>
          <p className="mt-1 text-xs text-gray-500">{s.sub}</p>
        </div>
      ))}
    </div>
  );
}
