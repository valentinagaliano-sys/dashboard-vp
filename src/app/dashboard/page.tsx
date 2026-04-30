import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchAggregate } from "@/lib/sheets";
import { resolveUser, filterGanttForUser, filterSummariesForUser } from "@/lib/partner-mapping";
import { Shell } from "@/components/Shell";
import { KpiCards } from "@/components/KpiCards";
import { SolutionCard } from "@/components/SolutionCard";
import { MiniGantt } from "@/components/MiniGantt";
import { PymeProjectionChart } from "@/components/PymeProjectionChart";
import { SolutionSummaryTable } from "@/components/SolutionSummaryTable";
import { getPymeTarget } from "@/lib/pyme-targets";
import type { ResolvedUser } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const bypass = process.env.BYPASS_AUTH === "1";
  let userEmail: string | null = null;
  if (bypass) {
    userEmail = process.env.BYPASS_USER || "valentina.galiano@feconsulting.cl";
  } else {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");
    userEmail = user.email ?? null;
  }

  const user = resolveUser(userEmail);

  if (!user) {
    return (
      <UnauthorizedShell email={userEmail}>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
          <h2 className="text-lg font-semibold">Tu cuenta aún no está asociada a un socio</h2>
          <p className="mt-2 text-sm">
            Contacta a tu ejecutivo FE para vincular <strong>{userEmail}</strong> a un socio del programa.
          </p>
        </div>
      </UnauthorizedShell>
    );
  }

  let weeks: string[] = [];
  let ganttRows: ReturnType<typeof filterGanttForUser> = [];
  let summaries: ReturnType<typeof filterSummariesForUser> = [];
  let fetchedAt = 0;
  let errorMsg: string | null = null;

  try {
    const agg = await fetchAggregate();
    weeks = agg.weeks;
    ganttRows = filterGanttForUser(agg.ganttRows, user);
    summaries = filterSummariesForUser(agg.summaries, user);
    fetchedAt = agg.fetchedAt;
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : "Error leyendo el Sheet";
  }

  const isAdmin = user.role === "admin";
  const isPartner = user.role === "partner";

  // Para vista admin, agrupamos cards por socio.
  const bySocio = new Map<string, typeof summaries>();
  for (const s of summaries) {
    if (!bySocio.has(s.socio)) bySocio.set(s.socio, []);
    bySocio.get(s.socio)!.push(s);
  }

  return (
    <Shell user={user} email={userEmail} fetchedAt={fetchedAt}>
      <div className="mb-6">
        <p className="text-sm font-medium text-brand-600">{user.label}</p>
        <h1 className="text-2xl font-semibold text-gray-900">
          {isAdmin
            ? "Vista global del programa"
            : user.partner /* empresa */}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {isAdmin
            ? "Cartera completa de soluciones del programa Valor Pyme 2026."
            : "Estas son las soluciones del programa Valor Pyme en las que participas."}
        </p>
      </div>

      {errorMsg && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-medium">No pudimos cargar los datos del Sheet</p>
          <p className="mt-1">{errorMsg}</p>
        </div>
      )}

      {!errorMsg && summaries.length === 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          No encontramos soluciones asociadas en el Sheet.
        </div>
      )}

      {/* Tabla resumen — todos los roles */}
      {summaries.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-700">
            Resumen
          </h2>
          <SolutionSummaryTable summaries={summaries} showSocio={isAdmin} />
        </section>
      )}

      {/* KPIs globales — solo admin */}
      {isAdmin && summaries.length > 0 && (
        <section className="mb-8">
          <KpiCards summaries={summaries} />
        </section>
      )}

      {/* Proyección agregada — solo admin */}
      {isAdmin && summaries.length > 0 && (
        <section className="mb-8">
          <PymeProjectionChart
            solutions={summaries
              .map((s) => {
                const t = getPymeTarget(s.slug);
                if (!t || t.pymeTarget == null) return null;
                const QUARTER_RAMP = [0.05, 0.25, 0.6, 1.0];
                const todayQ = Math.floor(new Date().getMonth() / 3);
                const achievedTotal = t.pymeTarget * (s.avance / 100);
                const refRamp = QUARTER_RAMP[todayQ] || 1;
                const actualByQuarter = QUARTER_RAMP.map((r, qi) =>
                  qi <= todayQ ? Math.round(achievedTotal * (r / refRamp)) : 0
                );
                return {
                  slug: s.slug,
                  label: `${s.socio} · ${s.solucion}`,
                  socio: s.socio,
                  pymeTarget: t.pymeTarget,
                  unit: t.unit,
                  actualByQuarter,
                };
              })
              .filter((x): x is NonNullable<typeof x> => x !== null)}
          />
        </section>
      )}

      {/* Cards de soluciones */}
      {summaries.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-700">
            {isPartner ? "Tus soluciones" : "Soluciones por socio"}
          </h2>
          {isPartner ? (
            <div className="grid gap-4 md:grid-cols-2">
              {summaries.map((s) => (
                <SolutionCard key={s.slug} s={s} showSocio={false} />
              ))}
            </div>
          ) : (
            <div className="space-y-8">
              {Array.from(bySocio.entries()).map(([socio, sols]) => (
                <div key={socio}>
                  <div className="mb-3 flex items-baseline justify-between">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-700">
                      {socio}
                    </h3>
                    <span className="text-xs text-gray-400">
                      {sols.length} {sols.length === 1 ? "solución" : "soluciones"}
                    </span>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {sols.map((s) => (
                      <SolutionCard key={s.slug} s={s} showSocio={false} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Gantt detallado — todos los roles, colapsable */}
      {ganttRows.length > 0 && (
        <section>
          <details className="group">
            <summary className="mb-3 cursor-pointer list-none">
              <h2 className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-700 hover:text-gray-900">
                <span className="transition-transform group-open:rotate-90">▶</span>
                Gantt detallado por etapa
                <span className="text-xs font-normal normal-case text-gray-400">
                  ({ganttRows.length} filas, {weeks.length} semanas)
                </span>
              </h2>
            </summary>
            <MiniGantt weeks={weeks} rows={ganttRows} showSocio={isAdmin} />
          </details>
        </section>
      )}
    </Shell>
  );
}

function UnauthorizedShell({
  email,
  children,
}: {
  email: string | null;
  children: React.ReactNode;
}) {
  const fakeUser: ResolvedUser = {
    role: "partner",
    partner: "—",
    label: "Empresa",
    subLabel: "—",
  };
  return (
    <Shell user={fakeUser} email={email}>
      {children}
    </Shell>
  );
}
