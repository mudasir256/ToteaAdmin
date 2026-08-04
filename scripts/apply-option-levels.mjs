/**
 * Applies the Sugar & Ice Levels table + seed rows to Supabase.
 *
 * Usage (requires a Supabase personal access token with DB write access):
 *   SUPABASE_ACCESS_TOKEN=sbp_... node --env-file=.env scripts/apply-option-levels.mjs
 *
 * Or paste the SQL from:
 *   supabase/migrations/20260804000000_create_menu_option_levels.sql
 * into the Supabase SQL Editor and run it.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRef =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
const accessToken = process.env.SUPABASE_ACCESS_TOKEN;

if (!projectRef) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL in .env");
  process.exit(1);
}

const sqlPath = resolve(
  process.cwd(),
  "supabase/migrations/20260804000000_create_menu_option_levels.sql",
);
const sql = readFileSync(sqlPath, "utf8");

if (!accessToken) {
  console.log("Table is not created yet. Apply this migration in Supabase:");
  console.log("");
  console.log("1. Open https://supabase.com/dashboard/project/" + projectRef + "/sql/new");
  console.log("2. Paste the SQL from:");
  console.log("   supabase/migrations/20260804000000_create_menu_option_levels.sql");
  console.log("3. Click Run");
  console.log("");
  console.log("That creates the table and adds:");
  console.log("  Sugar: Less Sugar ★, Light Sugar, Minimal Sugar, No Added, Super Sweet");
  console.log("  Ice:   No Ice, Less Ice, Normal Ice ★, More Ice");
  process.exit(0);
}

const response = await fetch(
  `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  },
);

const body = await response.text();
if (!response.ok) {
  console.error("Failed to apply migration:", response.status, body);
  process.exit(1);
}

console.log("Migration applied. Sugar & Ice Levels are ready.");
