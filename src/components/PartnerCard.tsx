import type { PartnerSummary } from "@/lib/types";
import { AvanceBar } from "./AvanceBar";

const UNIT_LABEL: Record<string, string> = {
  pymes: "PYMEs",
  trabajadores: "trabajadores PYME",
  empresas: "empresas",
};

const EJE_PILL: Record<string, string> = {
  Capital: "bg-amber-50 text-amber-700 ring-amber-600/20",
  Mercado: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  Digitalización: "bg-sky-50 text-sky-700 ring-sky-600/20",
  "Gestión y Talento": "bg-violet-50 text-violet-700 ring-violet-600/20",
};

function formatNumber(n: number): string {
  return n.toLocaleString("es-CL");
}

export function PartnerCard({ p }: { p: PartnerSummary }) {
  const pct = p.pymeMeta && p.pymeAcum != null ? Math.round((p.pymeAcum / p.pymeMeta) * 100) : 0;
  const unit = UNIT_LABEL[p.pymeUnit?.toLowerCase() ?? "pymes"] ?? "PYMEs";

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            {p.partner}
          </p>
          <h3 className="mt-0.5 truncate text-base font-semibold text-gray-900">{p.solucion}</h3>
        </div>
        {p.eje && (
          <span
            className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${
              EJE_PILL[p.eje] ?? "bg-gray-50 text-gray-700 ring-gray-300"
            }`}
          >
            {p.eje}
          </span>
        )}
      </div>

      <div className="mt-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
          PYMEs · acum / meta 2026
        </p>
        {p.pymeMeta != null || p.pymeAcum != null ? (
          <p className="mt-0.5 flex items-baseline gap-1">
            <span className="text-xl font-semibold tabular-nums text-brand-700">
              {p.pymeAcum != null ? formatNumber(p.pymeAcum) : "—"}
            </span>
            <span className="text-sm text-gray-400">
              / {p.pymeMeta != null ? formatNumber(p.pymeMeta) : "—"}
            </span>
            <span className="text-xs text-gray-500">{unit}</span>
          </p>
        ) : (
          <p className="mt-0.5 text-sm text-gray-400">por definir</p>
        )}
      </div>

      {p.pymeMeta != null && p.pymeAcum != null && (
        <div className="mt-3">
          <AvanceBar value={pct} size="sm" />
        </div>
      )}

      {p.pymeNotas && (
        <p className="mt-3 line-clamp-3 text-xs text-gray-600">{p.pymeNotas}</p>
      )}
    </div>
  );
}
