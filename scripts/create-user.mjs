import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

// Carga .env.local
const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
for (const line of raw.split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  let [, k, v] = m;
  if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
  if (!(k in process.env)) process.env[k] = v;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_ROOT;
if (!url || !secret) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_ROOT en .env.local");
  process.exit(1);
}

const [, , email, password] = process.argv;
if (!email || !password) {
  console.error("Uso: node scripts/create-user.mjs <email> <password>");
  console.error("Ej.:  node scripts/create-user.mjs nico@feconsulting.cl 'Vp2026!demo'");
  process.exit(1);
}

const admin = createClient(url, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true, // sin paso de verificación
});

if (error) {
  console.error("ERROR:", error.message);
  process.exit(1);
}

console.log("Usuario creado:");
console.log("  id:    ", data.user?.id);
console.log("  email: ", data.user?.email);
console.log("\nAhora puedes entrar en http://localhost:3002/login");
