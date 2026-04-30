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

const QUARTERS = ["Q1 2026", "Q2 2026", "Q3 2026", "Q4 2026"];
// Acumulado al cierre de cada trimestre, ramp-up estándar.
const QUARTER_RAMP = [0.05, 0.25, 0.6, 1.0];

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
  actualByQuarter?: number[]; // datos reales acumulados (cuando existan)
  unit?: string;
};

function currentQuarterIndex(d: Date): number {
  return Math.floor(d.getMonth() / 3);
}

export function PymeProjectionChart({
  solutions,
  today = new Date(),
}: {
  solutions: ChartSolution[];
  today?: Date;
}) {
  if (solutions.length === 0) return null;

  const todayQ = currentQuarterIndex(today);

  // Data por trimestre: para cada solución dos series — `<slug>__real` y `<slug>__proj`.
  // En trimestres ya cerrados (qi < todayQ) y el actual (qi === todayQ) → toda la cifra va a real.
  // En trimestres futuros (qi > todayQ) → toda la cifra va a proyectado.
  // Cuando no hay actuals reportados, real = 0 (las barras pasadas se ven vacías, intencional).
  const rows = QUARTERS.map((q, qi) => {
    const factor = QUARTER_RAMP[qi];
    const isProj = qi > todayQ;
    const row: Record<string, number | string> = { quarter: q };
    let metaAcum = 0;
    for (const s of solutions) {
      const target = Math.round(s.pymeTarget * factor);
      const actual = s.actualByQuarter?.[qi] ?? 0;
      row[`${s.slug}__real`] = isProj ? 0 : actual;
      row[`${s.slug}__proj`] = isProj ? target : 0;
      metaAcum += target;
    }
    row["__metaTotal"] = metaAcum;
    return row;
  });

  const totalMeta = solutions.reduce((acc, s) => acc + s.pymeTarget, 0);
  const todayQLabel = QUARTERS[todayQ];
  const projStartLabel = QUARTERS[Math.min(todayQ + 1, QUARTERS.length - 1)];
  const hasProjBand = todayQ < QUARTERS.length - 1;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-700">
            Adquisición de PYMEs · 2026
          </h3>
          <p className="mt-1 text-xs text-gray-500">
            Stacked bars por solución. Color sólido = real (acumulado reportado), patrón rayado =
            proyección (ramp-up estándar). Línea = meta total ({totalMeta.toLocaleString("es-CL")}{" "}
            PYMEs al cierre de Q4).
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <Swatch kind="real" />
          <span className="text-gray-700">Real</span>
          <Swatch kind="proj" />
          <span className="text-gray-700">Proyectado</span>
        </div>
      </div>

      {/* SVG patterns (hatch) para barras proyectadas */}
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
            <XAxis dataKey="quarter" tick={{ fill: "#64748b", fontSize: 12 }} />
            <YAxis
              tick={{ fill: "#64748b", fontSize: 12 }}
              tickFormatter={(v: number) =>
                v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}K` : `${v}`
              }
            />

            {/* Banda de fondo de la zona proyectada */}
            {hasProjBand && (
              <ReferenceArea
                x1={projStartLabel}
                x2={QUARTERS[QUARTERS.length - 1]}
                fill="#fef3c7"
                fillOpacity={0.35}
                ifOverflow="extendDomain"
              />
            )}

            {/* Línea vertical "hoy" */}
            <ReferenceLine
              x={todayQLabel}
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

            {/* Real (color sólido) — únicas que aparecen en leyenda */}
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
            {/* Proyectado (patrón rayado) — ocultas en leyenda */}
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
              dot={{ r: 4, fill: "#0f172a" }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-3 text-[11px] text-gray-400">
        Real = acumulado estimado a la fecha (hoy se aproxima como{" "}
        <span className="font-medium">meta × % avance del proyecto</span>, distribuido en los
        trimestres pasados con ramp-up estándar 5% / 25% / 60% / 100%). Proyección = meta restante
        distribuida con el mismo ramp-up. Cuando el Sheet reporte adquisición real por solución y
        trimestre, las barras sólidas se sustituirán automáticamente.
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
