import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchSheet } from "@/lib/sheets";
import { resolvePartner, filterRowsForPartner } from "@/lib/partner-mapping";
import { SignOutButton } from "@/components/SignOutButton";

export const dynamic = "force-dynamic";

function statusBadge(estado: string) {
  const e = estado.toLowerCase();
  if (e.includes("curso"))
    return "bg-emerald-50 text-emerald-700 ring-emerald-600/20";
  if (e.includes("pend"))
    return "bg-amber-50 text-amber-700 ring-amber-600/20";
  if (e.includes("comple") || e.includes("listo"))
    return "bg-blue-50 text-blue-700 ring-blue-600/20";
  return "bg-gray-50 text-gray-700 ring-gray-600/20";
}

export default async function DashboardPage() {
  // TEMP: bypass auth — usa email interno FE para ver todos los socios.
  const bypass = process.env.BYPASS_AUTH === "1";

  let userEmail: string | null = null;
  if (bypass) {
    userEmail = "valentina.galiano@feconsulting.cl";
  } else {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");
    userEmail = user.email ?? null;
  }

  const partner = resolvePartner(userEmail ?? "");

  if (!partner) {
    return (
      <Shell email={userEmail}>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
          <h2 className="text-lg font-semibold">Tu cuenta aún no está asociada a un socio</h2>
          <p className="mt-2 text-sm">
            Contacta a tu ejecutivo FE para que vincule tu email <strong>{userEmail}</strong> a tu
            socio.
          </p>
        </div>
      </Shell>
    );
  }

  let weeks: string[] = [];
  let rows: Awaited<ReturnType<typeof fetchSheet>>["rows"] = [];
  let fetchedAt = 0;
  let errorMsg: string | null = null;

  try {
    const sheet = await fetchSheet();
    weeks = sheet.weeks;
    rows = filterRowsForPartner(sheet.rows, partner);
    fetchedAt = sheet.fetchedAt;
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : "Error leyendo el Sheet";
  }

  // Agrupar por solución
  const grouped = new Map<string, typeof rows>();
  for (const r of rows) {
    if (!grouped.has(r.solucion)) grouped.set(r.solucion, []);
    grouped.get(r.solucion)!.push(r);
  }

  return (
    <Shell email={userEmail}>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className="text-sm font-medium text-brand-600">Socio</p>
          <h1 className="text-2xl font-semibold text-gray-900">
            {partner === "ALL" ? "Todos los socios (vista interna FE)" : partner}
          </h1>
        </div>
        {fetchedAt > 0 && (
          <p className="text-xs text-gray-500">
            Actualizado: {new Date(fetchedAt).toLocaleString("es-CL")}
          </p>
        )}
      </div>

      {errorMsg && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-medium">No pudimos cargar los datos del Sheet</p>
          <p className="mt-1">{errorMsg}</p>
        </div>
      )}

      {!errorMsg && grouped.size === 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          No encontramos proyectos asociados a tu socio en el Sheet.
        </div>
      )}

      <div className="space-y-6">
        {Array.from(grouped.entries()).map(([solucion, etapas]) => (
          <section
            key={solucion}
            className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
          >
            <header className="border-b border-gray-100 bg-gray-50/60 px-5 py-3">
              <h2 className="text-base font-semibold text-gray-900">{solucion || "(sin solución)"}</h2>
            </header>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-white text-gray-500">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Etapa</th>
                    <th className="px-4 py-2 text-left font-medium">Responsable</th>
                    <th className="px-4 py-2 text-left font-medium">Estado</th>
                    {weeks.map((w) => (
                      <th key={w} className="px-1 py-2 text-center text-[10px] font-medium tracking-wide">
                        {w}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {etapas.map((row, idx) => (
                    <tr key={idx} className="border-t border-gray-100">
                      <td className="whitespace-nowrap px-4 py-2 text-gray-900">{row.etapa}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-gray-600">{row.responsable}</td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${statusBadge(
                            row.estado
                          )}`}
                        >
                          {row.estado || "—"}
                        </span>
                      </td>
                      {row.semanas.map((cell, i) => (
                        <td key={i} className="px-1 py-2 text-center">
                          {cell ? (
                            <span className="inline-block h-3 w-3 rounded-sm bg-brand-500" />
                          ) : (
                            <span className="inline-block h-3 w-3 rounded-sm bg-gray-100" />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </Shell>
  );
}

function Shell({ email, children }: { email?: string | null; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">FE Consulting</p>
            <h1 className="text-base font-semibold text-gray-900">Dashboard VP Proyectos 2026</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-gray-600 sm:inline">{email}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
