import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { google } from "googleapis";

// Carga manual de .env.local (sin agregar dotenv como dep)
const envPath = resolve(process.cwd(), ".env.local");
const raw = readFileSync(envPath, "utf8");
for (const line of raw.split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  let [, k, v] = m;
  if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
  if (!(k in process.env)) process.env[k] = v;
}

let okSupabase = false;
let okGoogle = false;

console.log("=== Supabase ===");
try {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY");
  console.log("URL:", url);
  console.log("Key:", key.slice(0, 20) + "…");
  const supabase = createClient(url, key);
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  console.log("auth.getSession OK (sesión:", data.session ? "presente" : "null", ")");
  // Probar endpoint de auth real: signInWithPassword con credenciales falsas
  const { error: signErr } = await supabase.auth.signInWithPassword({
    email: "ping@invalid.test",
    password: "x",
  });
  if (signErr) {
    // Esperamos 400 "Invalid login credentials" — eso prueba que el endpoint responde
    console.log("auth endpoint responde:", signErr.message);
  }
  okSupabase = true;
} catch (e) {
  console.error("ERROR Supabase:", e.message);
}

console.log("\n=== Google Sheets ===");
try {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;
  const sheetId = process.env.SHEET_ID;
  const range = process.env.SHEET_RANGE || "Gantt!A1:AT200";
  if (!email || !rawKey || !sheetId) throw new Error("Faltan GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY o SHEET_ID");
  console.log("Service account:", email);
  console.log("Sheet ID:", sheetId);
  console.log("Range:", range);
  const key = rawKey.replace(/\\n/g, "\n");
  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  await auth.authorize();
  console.log("JWT autorizado OK");
  const sheets = google.sheets({ version: "v4", auth });
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range });
  const values = res.data.values ?? [];
  console.log(`Filas leídas: ${values.length}`);
  if (values.length > 0) {
    console.log("Primera fila (preview):", JSON.stringify(values[0]).slice(0, 200));
  }
  // meta del spreadsheet (nombre)
  const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId, fields: "properties.title,sheets.properties.title" });
  console.log("Spreadsheet:", meta.data.properties?.title);
  console.log("Pestañas:", (meta.data.sheets ?? []).map((s) => s.properties?.title).join(", "));
  okGoogle = true;
} catch (e) {
  console.error("ERROR Google:", e.message);
  if (e.code) console.error("code:", e.code);
}

console.log("\n=== Resumen ===");
console.log("Supabase:", okSupabase ? "OK" : "FALLÓ");
console.log("Google Sheets:", okGoogle ? "OK" : "FALLÓ");
process.exit(okSupabase && okGoogle ? 0 : 1);
