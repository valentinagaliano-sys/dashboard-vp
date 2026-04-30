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
  fields: "sheets.properties(title,gridProperties)",
});

const tabs = (meta.data.sheets ?? []).map((s) => s.properties?.title).filter(Boolean);
const onlyTab = process.argv[2];

for (const tab of tabs) {
  if (onlyTab && tab !== onlyTab) continue;
  const range = `'${tab}'!A1:AZ80`;
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SHEET_ID,
      range,
    });
    const values = res.data.values ?? [];
    console.log(`\n========== ${tab}  (${values.length} rows) ==========`);
    const max = Math.min(values.length, 60);
    for (let i = 0; i < max; i++) {
      const row = values[i] ?? [];
      const truncated = row.map((c) => {
        const s = String(c ?? "");
        return s.length > 60 ? s.slice(0, 57) + "…" : s;
      });
      console.log(`r${String(i).padStart(2, "0")}:`, JSON.stringify(truncated));
    }
  } catch (e) {
    console.log(`ERROR ${tab}: ${e.message}`);
  }
}
