import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchAggregate } from "@/lib/sheets";
import { resolveUser, filterGanttForUser, filterSummariesForUser } from "@/lib/partner-mapping";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const resolved = resolveUser(user.email);
  if (!resolved) {
    return NextResponse.json(
      { error: "Tu email no está autorizado. Contacta a tu ejecutivo FE." },
      { status: 403 }
    );
  }

  try {
    const url = new URL(request.url);
    const force = url.searchParams.get("refresh") === "1";
    const agg = await fetchAggregate(force);
    return NextResponse.json({
      role: resolved.role,
      partner: resolved.partner,
      weeks: agg.weeks,
      gantt: filterGanttForUser(agg.ganttRows, resolved),
      summaries: filterSummariesForUser(agg.summaries, resolved),
      fetchedAt: agg.fetchedAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
