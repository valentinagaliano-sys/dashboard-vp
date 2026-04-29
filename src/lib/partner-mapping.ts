import type { SheetRow } from "@/lib/sheets";

/**
 * Mapeo de email -> socio.
 *
 * Dos formas de mapear:
 *  1. Por dominio (ej: "@bci.cl" -> "BCI")
 *  2. Por email exacto (ej: "vendor@gmail.com" -> "Walmart")
 *
 * Internamente: SIEMPRE se llama a resolvePartner(email) que primero busca
 * el email exacto y luego el dominio.
 *
 * Los nombres de socio aquí DEBEN coincidir exactamente (case-insensitive)
 * con los valores de la columna "Socio" del Google Sheet.
 */

const DOMAIN_TO_PARTNER: Record<string, string> = {
  "bci.cl": "BCI",
  "walmart.com": "Walmart",
  "walmartchile.cl": "Walmart",
  "blue.cl": "Blue Express",
  "blueexpress.cl": "Blue Express",
  "defontana.com": "Defontana",
  "microsoft.com": "Microsoft",
  "cchc.cl": "OTIC CChC",
  "oticcchc.cl": "OTIC CChC",
  "uc.cl": "EAUC",
  "eclass.cl": "EAUC",
  // Agrega aquí los dominios de Nicolas Inc cuando corresponda:
  // "nicolasinc.com": "Nicolas Inc",
};

const EMAIL_TO_PARTNER: Record<string, string> = {
  // Excepciones por usuario individual cuando el dominio no aplica.
  // "ejemplo@gmail.com": "Walmart",
};

// Emails internos del equipo FE: ven todos los socios.
const FE_INTERNAL_DOMAINS = new Set(["feconsulting.cl"]);

export function resolvePartner(email: string): string | "ALL" | null {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  // Equipo interno: acceso total
  const domain = normalized.split("@")[1] ?? "";
  if (FE_INTERNAL_DOMAINS.has(domain)) return "ALL";

  if (EMAIL_TO_PARTNER[normalized]) return EMAIL_TO_PARTNER[normalized];
  if (DOMAIN_TO_PARTNER[domain]) return DOMAIN_TO_PARTNER[domain];

  return null;
}

export function filterRowsForPartner(rows: SheetRow[], partner: string | "ALL"): SheetRow[] {
  if (partner === "ALL") return rows;
  const target = partner.trim().toLowerCase();
  return rows.filter((r) => r.socio.trim().toLowerCase() === target);
}
