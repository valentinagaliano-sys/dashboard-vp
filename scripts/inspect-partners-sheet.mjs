import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { google } from "googleapis";

const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
for (const line of raw.split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  let [, k, v] = m;
  if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
  if (!(k in process.env)) process.env[k] = v;
}

const auth = new google.auth.JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});

const sheets = google.sheets({ version: "v4", auth });
const PARTNER_SHEET_ID = "1vPHSBTEizYHyT2hJ7Iy2W9bB-GzXAQnPH_ugIryTPWY";

const meta = await sheets.spreadsheets.get({
  spreadsheetId: PARTNER_SHEET_ID,
  fields: "properties.title,sheets.properties(title,gridProperties)",
});
console.log("Spreadsheet:", meta.data.properties?.title);
console.log("\nPestañas:");
for (const s of meta.data.sheets ?? []) {
  const p = s.properties;
  console.log(`  - "${p?.title}" (${p?.gridProperties?.rowCount}x${p?.gridProperties?.columnCount})`);
}

console.log("\n--- Contenido por pestaña ---");
for (const s of meta.data.sheets ?? []) {
  const tab = s.properties?.title;
  if (!tab) continue;
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: PARTNER_SHEET_ID,
      range: `'${tab}'!A1:AZ50`,
    });
    const values = res.data.values ?? [];
    console.log(`\n========== ${tab}  (${values.length} rows) ==========`);
    const max = Math.min(values.length, 35);
    for (let i = 0; i < max; i++) {
      const row = values[i] ?? [];
      const truncated = row.map((c) => {
        const s = String(c ?? "");
        return s.length > 50 ? s.slice(0, 47) + "…" : s;
      });
      console.log(`r${String(i).padStart(2, "0")}:`, JSON.stringify(truncated));
    }
  } catch (e) {
    console.log(`ERROR ${tab}: ${e.message}`);
  }
}
