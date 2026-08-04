import { NextResponse } from "next/server";

import { getPublicOptionLevels } from "@/lib/dashboard/data";
import { createClient } from "@/lib/supabase/server";

type OptionLevelKind = "sugar" | "ice";

async function requireAdmin() {
  const supabase = await createClient();
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

export async function GET() {
  try {
    const levels = await getPublicOptionLevels();
    return NextResponse.json(levels);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load option levels." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth && auth.error) return auth.error;

  const body = (await request.json().catch(() => null)) as {
    kind?: string;
    name?: string;
    sortOrder?: number;
    isDefault?: boolean;
    isActive?: boolean;
  } | null;

  const kind = body?.kind === "ice" || body?.kind === "sugar" ? (body.kind as OptionLevelKind) : null;
  const name = body?.name?.trim() ?? "";

  if (!kind || !name) {
    return NextResponse.json(
      { error: "Both kind (sugar|ice) and name are required." },
      { status: 400 },
    );
  }

  const { data, error } = await auth.supabase!
    .from("menu_option_levels")
    .insert({
      kind,
      name,
      sort_order: Number.isFinite(body?.sortOrder) ? Number(body?.sortOrder) : 0,
      is_default: Boolean(body?.isDefault),
      is_active: body?.isActive !== false,
    })
    .select("id, kind, name, sort_order, is_default, is_active, created_at, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ level: data }, { status: 201 });
}
