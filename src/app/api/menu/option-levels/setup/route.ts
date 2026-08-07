import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { createClient as createServerClient } from "@/lib/supabase/server";

const DEFAULT_LEVELS = [
  { kind: "sugar" as const, name: "Light Sugar", sort_order: 1, is_default: true },
  { kind: "sugar" as const, name: "Minimal Sugar", sort_order: 2, is_default: false },
  { kind: "sugar" as const, name: "No Added", sort_order: 3, is_default: false },
  { kind: "sugar" as const, name: "Super Sweet", sort_order: 4, is_default: false },
  { kind: "ice" as const, name: "No Ice", sort_order: 0, is_default: false },
  { kind: "ice" as const, name: "Less Ice", sort_order: 1, is_default: false },
  { kind: "ice" as const, name: "Normal Ice", sort_order: 2, is_default: true },
  { kind: "ice" as const, name: "More Ice", sort_order: 3, is_default: false },
];

async function requireAdmin() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { supabase };
}

function migrationSql() {
  return readFileSync(
    resolve(process.cwd(), "supabase/migrations/20260804000000_create_menu_option_levels.sql"),
    "utf8",
  );
}

function projectSqlEditorUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const ref = url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
  return ref ? `https://supabase.com/dashboard/project/${ref}/sql/new` : "https://supabase.com/dashboard";
}

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth && auth.error) return auth.error;

  return NextResponse.json({
    defaults: DEFAULT_LEVELS,
    sql: migrationSql(),
    sqlEditorUrl: projectSqlEditorUrl(),
  });
}

export async function POST() {
  const auth = await requireAdmin();
  if ("error" in auth && auth.error) return auth.error;

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !url) {
    return NextResponse.json(
      {
        error: "Missing Supabase env vars.",
        sql: migrationSql(),
        defaults: DEFAULT_LEVELS,
      },
      { status: 500 },
    );
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Prefer seeding when the table already exists.
  const { data, error } = await admin
    .from("menu_option_levels")
    .upsert(DEFAULT_LEVELS, { onConflict: "kind,name" })
    .select("id, kind, name, sort_order, is_default, is_active, created_at, updated_at");

  if (!error) {
    return NextResponse.json({
      ok: true,
      levels: data ?? [],
      message: "Default Sugar & Ice levels are ready.",
    });
  }

  const missingTable =
    error.message.includes("schema cache") ||
    error.message.includes("does not exist") ||
    error.code === "42P01";

  return NextResponse.json(
    {
      error: missingTable
        ? "Table is missing. Run the SQL below once in the Supabase SQL Editor, then click Install defaults again."
        : error.message,
      needsMigration: missingTable,
      sql: migrationSql(),
      sqlEditorUrl: projectSqlEditorUrl(),
      defaults: DEFAULT_LEVELS,
    },
    { status: missingTable ? 409 : 400 },
  );
}
