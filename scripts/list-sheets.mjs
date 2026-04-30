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
const meta = await sheets.spreadsheets.get({
  spreadsheetId: process.env.SHEET_ID,
  fields: "properties.title,sheets.properties(title,gridProperties)",
});

console.log("Spreadsheet:", meta.data.properties?.title);
console.log("\nPestañas:");
for (const s of meta.data.sheets ?? []) {
  const p = s.properties;
  console.log(`  - "${p?.title}" (${p?.gridProperties?.rowCount}x${p?.gridProperties?.columnCount})`);
}
