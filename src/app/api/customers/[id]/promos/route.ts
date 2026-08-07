import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import type { CustomerPromoDTO } from "@/lib/dashboard/types";

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

  return { supabase, userId: user.id };
}

type RouteContext = {
  params: Promise<{ id: string }>;
};

function mapPromo(row: {
  id: string;
  status: string;
  note: string | null;
  assigned_at: string;
  used_at: string | null;
  used_order_id: string | null;
  promo_codes:
    | {
        code: string;
        discount_type: string;
        discount_value: number;
      }
    | {
        code: string;
        discount_type: string;
        discount_value: number;
      }[]
    | null;
}): CustomerPromoDTO | null {
  const promo = Array.isArray(row.promo_codes) ? row.promo_codes[0] : row.promo_codes;
  if (!promo) return null;
  return {
    id: row.id,
    code: promo.code,
    discountType: promo.discount_type === "percent" ? "percent" : "fixed",
    discountValue: Number(promo.discount_value),
    status:
      row.status === "used" || row.status === "revoked" ? row.status : "available",
    note: row.note,
    assignedAt: row.assigned_at,
    usedAt: row.used_at,
    usedOrderId: row.used_order_id,
  };
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAdmin();
  if ("error" in auth && auth.error) return auth.error;

  const { id: customerId } = await context.params;
  const { data, error } = await auth.supabase!
    .from("customer_promo_codes")
    .select(
      "id, status, note, assigned_at, used_at, used_order_id, promo_codes(code, discount_type, discount_value)",
    )
    .eq("user_id", customerId)
    .order("assigned_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const promos = (data ?? [])
    .map((row) => mapPromo(row as Parameters<typeof mapPromo>[0]))
    .filter(Boolean) as CustomerPromoDTO[];

  return NextResponse.json({ promos });
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAdmin();
  if ("error" in auth && auth.error) return auth.error;

  const { id: customerId } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    code?: string;
    discountType?: string;
    discountValue?: number;
    note?: string;
  } | null;

  const code = (body?.code ?? "").trim().toUpperCase();
  const discountType = body?.discountType === "percent" ? "percent" : "fixed";
  const discountValue = Number(body?.discountValue);
  const note = body?.note?.trim() || null;

  if (!code || code.length < 2) {
    return NextResponse.json({ error: "Enter a promo code (at least 2 characters)." }, { status: 400 });
  }
  if (!Number.isFinite(discountValue) || discountValue <= 0) {
    return NextResponse.json({ error: "Enter a valid discount amount." }, { status: 400 });
  }
  if (discountType === "percent" && discountValue > 100) {
    return NextResponse.json({ error: "Percent discount cannot exceed 100." }, { status: 400 });
  }

  const { data: profile } = await auth.supabase!
    .from("profiles")
    .select("id")
    .eq("id", customerId)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "Customer not found." }, { status: 404 });
  }

  const { data: existingCode } = await auth.supabase!
    .from("promo_codes")
    .select("id, discount_type, discount_value, is_active")
    .eq("code", code)
    .maybeSingle();

  let promoCodeId = existingCode?.id as string | undefined;

  if (existingCode) {
    const { error: updateError } = await auth.supabase!
      .from("promo_codes")
      .update({
        discount_type: discountType,
        discount_value: discountValue,
        is_active: true,
      })
      .eq("id", existingCode.id);
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }
  } else {
    const { data: created, error: createError } = await auth.supabase!
      .from("promo_codes")
      .insert({
        code,
        discount_type: discountType,
        discount_value: discountValue,
        is_active: true,
      })
      .select("id")
      .single();
    if (createError || !created) {
      return NextResponse.json(
        { error: createError?.message ?? "Could not create promo code." },
        { status: 400 },
      );
    }
    promoCodeId = created.id;
  }

  const { data: available } = await auth.supabase!
    .from("customer_promo_codes")
    .select("id")
    .eq("user_id", customerId)
    .eq("promo_code_id", promoCodeId!)
    .eq("status", "available")
    .maybeSingle();

  if (available) {
    return NextResponse.json(
      { error: "This customer already has that promo available." },
      { status: 400 },
    );
  }

  const { data: assignment, error: assignError } = await auth.supabase!
    .from("customer_promo_codes")
    .insert({
      user_id: customerId,
      promo_code_id: promoCodeId!,
      assigned_by: auth.userId,
      note,
      status: "available",
    })
    .select(
      "id, status, note, assigned_at, used_at, used_order_id, promo_codes(code, discount_type, discount_value)",
    )
    .single();

  if (assignError || !assignment) {
    return NextResponse.json(
      { error: assignError?.message ?? "Could not assign promo." },
      { status: 400 },
    );
  }

  const promo = mapPromo(assignment as Parameters<typeof mapPromo>[0]);
  return NextResponse.json({ promo });
}
