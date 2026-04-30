import Link from "next/link";
import type { SolutionSummary } from "@/lib/types";
import { EtapaDots } from "./EtapaDots";
import { AvanceBar } from "./AvanceBar";
import { getPymeTarget } from "@/lib/pyme-targets";

const UNIT_LABEL: Record<string, string> = {
  pymes: "PYMEs",
  trabajadores: "trabajadores PYME",
  empresas: "empresas",
};

function formatNumber(n: number): string {
  return n.toLocaleString("es-CL");
}

export function SolutionCard({ s, showSocio = true }: { s: SolutionSummary; showSocio?: boolean }) {
  const href = `/dashboard/${s.slug}`;
  const hasFecha = s.fechaHito && s.fechaHito.toLowerCase() !== "pendiente";
  const target = getPymeTarget(s.slug);

  return (
    <Link
      href={href}
      className="group block overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-brand-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {showSocio && (
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{s.socio}</p>
          )}
          <h3 className="mt-0.5 truncate text-base font-semibold text-gray-900 group-hover:text-brand-700">
            {s.solucion}
          </h3>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-2xl font-semibold tabular-nums text-gray-900">{s.avance}%</p>
          <p className="text-[10px] uppercase tracking-wider text-gray-400">avance</p>
        </div>
      </div>

      <div className="mt-3">
        <AvanceBar value={s.avance} size="sm" />
      </div>

      {/* KPI principal: meta de PYMEs */}
      <div className="mt-4 flex items-end justify-between border-b border-gray-100 pb-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Meta 2026</p>
          {target && target.pymeTarget != null ? (
            <p className="mt-0.5">
              <span className="text-xl font-semibold tabular-nums text-brand-700">
                {formatNumber(target.pymeTarget)}
              </span>{" "}
              <span className="text-xs text-gray-500">{UNIT_LABEL[target.unit ?? "pymes"]}</span>
            </p>
          ) : (
            <p className="mt-0.5 text-sm text-gray-400">por definir</p>
          )}
        </div>
        {target?.sharedGroup && (
          <span className="text-[10px] uppercase tracking-wider text-amber-600" title="Meta compartida con otra solución">
            meta compartida
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <EtapaDots etapas={s.etapas} />
        {!s.detTab && (
          <span className="text-[10px] uppercase tracking-wider text-gray-300">sin detalle</span>
        )}
      </div>

      {s.proximoHito && (
        <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50/70 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Próximo hito</p>
          <p className="mt-0.5 line-clamp-2 text-sm text-gray-800">{s.proximoHito}</p>
          {hasFecha && (
            <p className="mt-1 text-xs font-medium text-brand-700">{s.fechaHito}</p>
          )}
          {!hasFecha && s.fechaHito && (
            <p className="mt-1 text-xs text-amber-700">Fecha por definir</p>
          )}
        </div>
      )}
    </Link>
  );
}
