"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const PALETTE = [
  "#2f48b3", "#3a7bd5", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#6366f1",
  "#06b6d4", "#84cc16", "#a855f7", "#d946ef", "#0ea5e9",
];

export type ChartSolution = {
  slug: string;
  label: string;
  socio: string;
  pymeTarget: number;
  /** Ingresos NUEVOS de cada mes (incremental, null en meses sin reporte).
   *  El acumulado se calcula sumando los meses reportados. */
  monthly: (number | null)[];
};

export function PymeProjectionChart({
  solutions,
  today = new Date(),
}: {
  solutions: ChartSolution[];
  today?: Date;
}) {
  if (solutions.length === 0) return null;

  const todayMonth = today.getMonth(); // 0..11

  // Para cada solución calculamos:
  //  - real[m]: acumulado a la fecha (suma de los meses reportados hasta m)
  //  - proj[m]: proyección lineal entre el último acumulado reportado y la meta a Dic
  // En el chart usamos dos series por solución (`__real` y `__proj`) que se apilan.
  // En cada mes la solución contribuye con UNA de las dos (la otra es 0).
  function buildSeries(s: ChartSolution): { real: number[]; proj: number[] } {
    const real: number[] = Array(12).fill(0);
    const proj: number[] = Array(12).fill(0);

    // `monthly` es incremental: vamos sumando para obtener el acumulado corrido.
    // Un mes sin reporte (null) no suma pero arrastra el acumulado anterior.
    const cum: number[] = Array(12).fill(0);
    let running = 0;
    let lastReportedMonth = -1;
    for (let m = 0; m < 12; m++) {
      if (s.monthly[m] != null) {
        running += s.monthly[m] as number;
        lastReportedMonth = m;
      }
      cum[m] = running;
    }

    for (let m = 0; m < 12; m++) {
      if (m <= lastReportedMonth) {
        // Tramo reportado: acumulado real a ese mes.
        real[m] = cum[m];
      } else {
        // Tramo futuro: proyección lineal entre el último acumulado reportado
        // (mes lastReportedMonth, o 0 si nunca se reportó) y la meta a Dic.
        const startMonth = lastReportedMonth;
        const startVal = lastReportedMonth >= 0 ? cum[lastReportedMonth] : 0;
        const remainingMonths = 11 - startMonth;
        if (remainingMonths <= 0) {
          proj[m] = s.pymeTarget;
        } else {
          const step = (s.pymeTarget - startVal) / remainingMonths;
          proj[m] = Math.max(0, Math.round(startVal + step * (m - startMonth)));
        }
      }
    }
    return { real, proj };
  }

  const series = solutions.map(buildSeries);

  // Construir filas para Recharts
  const rows = MONTHS.map((label, m) => {
    const row: Record<string, number | string> = { month: label };
    let metaTotal = 0;
    for (let i = 0; i < solutions.length; i++) {
      row[`${solutions[i].slug}__real`] = series[i].real[m];
      row[`${solutions[i].slug}__proj`] = series[i].proj[m];
      metaTotal += solutions[i].pymeTarget;
    }
    row["__metaTotal"] = metaTotal;
    return row;
  });

  const totalMeta = solutions.reduce((acc, s) => acc + s.pymeTarget, 0);
  const todayLabel = MONTHS[todayMonth];
  const projStartLabel = MONTHS[Math.min(todayMonth + 1, 11)];
  const hasProjBand = todayMonth < 11;
  const reportedMonths = solutions.flatMap((s) => s.monthly.map((v, i) => (v != null ? i : -1))).filter((m) => m >= 0);
  const lastReported = reportedMonths.length > 0 ? Math.max(...reportedMonths) : -1;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-700">
            Adquisición de PYMEs · 2026
          </h3>
          <p className="mt-1 text-xs text-gray-500">
            Acumulado mensual por solución (apilado). Color sólido = reportado en KPIs_PYMEs;
            patrón rayado = proyección lineal hacia meta. Línea = meta total ({totalMeta.toLocaleString("es-CL")}{" "}
            PYMEs).
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <Swatch kind="real" />
          <span className="text-gray-700">Real</span>
          <Swatch kind="proj" />
          <span className="text-gray-700">Proyectado</span>
        </div>
      </div>

      <svg width="0" height="0" style={{ position: "absolute" }}>
        <defs>
          {solutions.map((s, i) => {
            const color = PALETTE[i % PALETTE.length];
            return (
              <pattern
                key={s.slug}
                id={`hatch-${s.slug}`}
                width={7}
                height={7}
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <rect width={7} height={7} fill={color} fillOpacity={0.18} />
                <line x1={0} y1={0} x2={0} y2={7} stroke={color} strokeWidth={2.5} />
              </pattern>
            );
          })}
        </defs>
      </svg>

      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 12 }} />
            <YAxis
              tick={{ fill: "#64748b", fontSize: 12 }}
              tickFormatter={(v: number) =>
                v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}K` : `${v}`
              }
            />

            {hasProjBand && lastReported >= 0 && lastReported < 11 && (
              <ReferenceArea
                x1={MONTHS[lastReported + 1]}
                x2={MONTHS[11]}
                fill="#fef3c7"
                fillOpacity={0.3}
                ifOverflow="extendDomain"
              />
            )}

            <ReferenceLine
              x={todayLabel}
              stroke="#dc2626"
              strokeDasharray="4 3"
              label={{
                value: "Hoy",
                position: "insideTopRight",
                fill: "#dc2626",
                fontSize: 11,
                fontWeight: 600,
              }}
            />

            <Tooltip
              contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }}
              formatter={(value, _name, item) => {
                const v = typeof value === "number" ? value : Number(value);
                if (!Number.isFinite(v) || v === 0) return null as unknown as [string, string];
                const dk = String(item?.dataKey ?? "");
                const label = String(item?.name ?? dk);
                if (dk === "__metaTotal") return [v.toLocaleString("es-CL"), label];
                const kind = dk.endsWith("__real") ? "real" : "proyectado";
                return [`${v.toLocaleString("es-CL")}  (${kind})`, label];
              }}
              labelStyle={{ fontWeight: 600, color: "#0f172a" }}
            />

            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />

            {solutions.map((s, i) => (
              <Bar
                key={`${s.slug}-real`}
                dataKey={`${s.slug}__real`}
                name={s.label}
                stackId="adq"
                fill={PALETTE[i % PALETTE.length]}
                isAnimationActive={false}
              />
            ))}
            {solutions.map((s, i) => (
              <Bar
                key={`${s.slug}-proj`}
                dataKey={`${s.slug}__proj`}
                name={s.label}
                stackId="adq"
                fill={`url(#hatch-${s.slug})`}
                stroke={PALETTE[i % PALETTE.length]}
                strokeOpacity={0.45}
                strokeWidth={1}
                legendType="none"
                isAnimationActive={false}
              />
            ))}

            <Line
              type="monotone"
              dataKey="__metaTotal"
              name="Meta total acumulada"
              stroke="#0f172a"
              strokeWidth={2.5}
              strokeDasharray="6 4"
              dot={{ r: 3, fill: "#0f172a" }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-3 text-[11px] text-gray-400">
        Real = acumulado a la fecha. El cliente escribe en la pestaña{" "}
        <span className="font-medium">KPIs_PYMEs</span> el alta de cada mes (ingresos nuevos) y el
        dashboard las suma. Proyección = trayectoria lineal entre el último mes reportado y la meta
        a diciembre.
      </p>
    </div>
  );
}

function Swatch({ kind }: { kind: "real" | "proj" }) {
  if (kind === "real") {
    return <span className="inline-block h-3 w-4 rounded-sm bg-brand-600" />;
  }
  return (
    <span
      className="inline-block h-3 w-4 rounded-sm border border-brand-600"
      style={{
        backgroundImage:
          "repeating-linear-gradient(45deg, #2f48b3 0 2px, transparent 2px 6px)",
      }}
    />
  );
}
