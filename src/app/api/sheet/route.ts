import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchSheet } from "@/lib/sheets";
import { resolvePartner, filterRowsForPartner } from "@/lib/partner-mapping";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const partner = resolvePartner(user.email ?? "");
  if (!partner) {
    return NextResponse.json(
      { error: "Tu email no está autorizado. Contacta a tu ejecutivo FE." },
      { status: 403 }
    );
  }

  try {
    const url = new URL(request.url);
    const force = url.searchParams.get("refresh") === "1";
    const sheet = await fetchSheet(force);
    const filtered = filterRowsForPartner(sheet.rows, partner);

    return NextResponse.json({
      partner,
      weeks: sheet.weeks,
      rows: filtered,
      fetchedAt: sheet.fetchedAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
